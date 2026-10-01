// Minimal raw-socket CDP screenshot client (no ws dependency).
// Usage: node cdp-shot.mjs <url> <out.png> [width] [height]
// Chrome must be running with --remote-debugging-port=9222.
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";

const [url, out, wArg, hArg] = process.argv.slice(2);
const WIDTH = parseInt(wArg || "1440", 10);
const HEIGHT = parseInt(hArg || "900", 10);

function wsConnect(port, path) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, "127.0.0.1", () => {
      const key = crypto.randomBytes(16).toString("base64");
      sock.write(
        `GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let buf = Buffer.alloc(0);
    sock.once("error", reject);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf("\r\n\r\n");
      if (idx !== -1) {
        sock.off("data", onData);
        resolve({ sock, rest: buf.subarray(idx + 4) });
      }
    };
    sock.on("data", onData);
  });
}

function sendText(sock, str) {
  const payload = Buffer.from(str);
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
    mask.copy(header, 2);
  } else {
    header = Buffer.alloc(8);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
    mask.copy(header, 4);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
  sock.write(Buffer.concat([header, masked]));
}

async function main() {
  const BROWSER_INIT = process.env.BROWSER_INIT === "1";

  async function browserWsUrl() {
    // /json/version -> browser-level webSocketDebuggerUrl (read Content-Length; socket stays open)
    return await new Promise((resolve, reject) => {
      const s = net.connect(9222, "127.0.0.1", () => {
        s.write("GET /json/version HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
      });
      let buf = Buffer.alloc(0);
      s.on("data", (c) => {
        buf = Buffer.concat([buf, c]);
        const str = buf.toString();
        const hEnd = str.indexOf("\r\n\r\n");
        if (hEnd === -1) return;
        const m = str.match(/content-length:\s*(\d+)/i);
        const want = m ? parseInt(m[1], 10) : 0;
        const bs = hEnd + 4;
        if (buf.length >= bs + want) {
          s.destroy();
          try {
            resolve(JSON.parse(buf.subarray(bs, bs + want).toString()).webSocketDebuggerUrl);
          } catch (e) {
            reject(e);
          }
        }
      });
      s.on("error", reject);
      setTimeout(() => reject(new Error("timeout /json/version")), 15000);
    });
  }

  // light WS session helper reused for the browser-level connection
  async function wsSession(wsUrl, onMsg) {
    const u = new URL(wsUrl);
    const { sock, rest } = await wsConnect(9222, u.pathname + u.search);
    let buf = rest;
    let msgBuf = "";
    const pending = new Map();
    let id = 0;
    function send(method, params = {}) {
      const mid = ++id;
      return new Promise((resolve) => {
        pending.set(mid, resolve);
        sendText(sock, JSON.stringify({ id: mid, method, params }));
      });
    }
    function handleMessage(text) {
      let m;
      try {
        m = JSON.parse(text);
      } catch {
        return;
      }
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      } else if (onMsg) onMsg(m);
    }
    function pump(chunk) {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const fin = buf[0] & 0x80;
        const opcode = buf[0] & 0x0f;
        let len = buf[1] & 0x7f;
        let off = 2;
        if (len === 126) {
          if (buf.length < 4) break;
          len = buf.readUInt16BE(2);
          off = 4;
        } else if (len === 127) {
          if (buf.length < 10) break;
          len = Number(buf.readBigUInt64BE(2));
          off = 10;
        }
        if (buf[1] & 0x80) off += 4;
        if (buf.length < off + len) break;
        const payload = buf.subarray(off, off + len);
        buf = buf.subarray(off + len);
        if (opcode === 0x8) {
          sock.end();
          return;
        }
        if (opcode === 0x1 || opcode === 0x0) {
          msgBuf += payload.toString();
          if (fin) {
            handleMessage(msgBuf);
            msgBuf = "";
          }
        }
      }
    }
    sock.on("data", pump);
    return { sock, send };
  }

  let pageWsUrl;
  const INIT_URL = process.env.INIT_URL || "";
  if (BROWSER_INIT) {
    const bUrl = await browserWsUrl();
    const b = await wsSession(bUrl);
    const res = await b.send("Target.createTarget", { url: INIT_URL || url });
    const targetId = res.targetId;
    b.sock.end();
    // poll /json/list for the new page target's ws url
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 200));
      const targets = await new Promise((resolve, reject) => {
        const s = net.connect(9222, "127.0.0.1", () => {
          s.write("GET /json/list HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
        });
        let buf = Buffer.alloc(0);
        s.on("data", (c) => {
          buf = Buffer.concat([buf, c]);
          const str = buf.toString();
          const hEnd = str.indexOf("\r\n\r\n");
          if (hEnd === -1) return;
          const m = str.match(/content-length:\s*(\d+)/i);
          const want = m ? parseInt(m[1], 10) : 0;
          const bs = hEnd + 4;
          if (buf.length >= bs + want) {
            s.destroy();
            resolve(JSON.parse(buf.subarray(bs, bs + want).toString()));
          }
        });
        s.on("error", reject);
      });
      const t = targets.find((x) => x.id === targetId);
      if (t && t.webSocketDebuggerUrl) {
        pageWsUrl = t.webSocketDebuggerUrl;
        break;
      }
    }
    if (!pageWsUrl) throw new Error("new target never appeared");
  } else {
    // legacy path: reuse an existing page target
    const targets = await new Promise((resolve, reject) => {
      const s = net.connect(9222, "127.0.0.1", () => {
        s.write("GET /json/list HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
      });
      let buf = Buffer.alloc(0);
      s.on("data", (c) => {
        buf = Buffer.concat([buf, c]);
        const str = buf.toString();
        const hEnd = str.indexOf("\r\n\r\n");
        if (hEnd === -1) return;
        const m = str.match(/content-length:\s*(\d+)/i);
        const want = m ? parseInt(m[1], 10) : 0;
        const bs = hEnd + 4;
        if (buf.length >= bs + want) {
          s.destroy();
          try {
            resolve(JSON.parse(buf.subarray(bs, bs + want).toString()));
          } catch (e) {
            reject(e);
          }
        }
      });
      s.on("error", reject);
      setTimeout(() => reject(new Error("timeout /json/list")), 15000);
    });
    const page =
      targets.find((t) => t.type === "page" && !t.url.startsWith("chrome://")) ||
      targets.find((t) => t.type === "page");
    if (!page) throw new Error("no page target");
    pageWsUrl = page.webSocketDebuggerUrl;
  }
  const wsUrl = new URL(pageWsUrl);

  // 2. open websocket
  const { sock, rest } = await wsConnect(9222, wsUrl.pathname + wsUrl.search);
  let buf = rest;
  let msgBuf = "";
  const pending = new Map();
  let id = 0;
  let loadFired = false;
  let screenshotB64 = null;

  function nextId() {
    return ++id;
  }
  function send(method, params = {}) {
    const mid = nextId();
    return new Promise((resolve) => {
      pending.set(mid, resolve);
      sendText(sock, JSON.stringify({ id: mid, method, params }));
    });
  }

  function handleMessage(text) {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (process.env.CDP_DEBUG) console.error("MSG:", text.slice(0, 160));
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
    if (m.method === "Page.loadEventFired") loadFired = true;
  }

  function pump(chunk) {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80;
      const opcode = buf[0] & 0x0f;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) break;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) break;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      const masked = buf[1] & 0x80;
      if (masked) off += 4; // server frames are unmasked; be safe anyway
      if (buf.length < off + len) break;
      const payload = buf.subarray(off, off + len);
      buf = buf.subarray(off + len);
      if (opcode === 0x8) {
        sock.end();
        return;
      }
      if (opcode === 0x1 || opcode === 0x0) {
        msgBuf += payload.toString();
        if (fin) {
          handleMessage(msgBuf);
          msgBuf = "";
        }
      }
    }
  }
  sock.on("data", pump);

  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const SKIP_NAV = process.env.SKIP_NAV === "1" || (BROWSER_INIT && !INIT_URL);
  if (!SKIP_NAV) {
    const navP = send("Page.navigate", { url });
    const waitLoad = new Promise((resolve) => {
      const t = setInterval(() => {
        if (loadFired) {
          clearInterval(t);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(t);
        resolve();
      }, 15000);
    });
    await navP;
    await waitLoad;
  } else {
    await new Promise((r) => setTimeout(r, 1500)); // page pre-loaded by chrome launch
  }
  await new Promise((r) => setTimeout(r, 1200)); // let client fetch settle
  const res = await send("Page.captureScreenshot", { format: "png" });
  screenshotB64 = res.data;
  fs.writeFileSync(out, Buffer.from(screenshotB64, "base64"));
  console.log(`wrote ${out} (${WIDTH}x${HEIGHT})`);
  sock.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("SHOT FAILED:", e.message);
  process.exit(1);
});
