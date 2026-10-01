#!/usr/bin/env python3
"""Tiny forward proxy for Chromium screenshotting.
Listens on 127.0.0.1:8888, forwards through the upstream proxy in $https_proxy,
injecting Proxy-Authorization. Handles CONNECT tunnels and plain-HTTP requests.
Stdlib only.
"""
import base64, os, select, socket, threading, urllib.parse

LISTEN = ("127.0.0.1", 8888)

up = os.environ.get("https_proxy") or os.environ.get("HTTPS_PROXY") or ""
p = urllib.parse.urlparse(up)
UP_HOST, UP_PORT = p.hostname, p.port or 8080
UP_AUTH = ""
if p.username:
    creds = p.username + (":" + urllib.parse.unquote(p.password or "") if p.password else "")
    UP_AUTH = "Basic " + base64.b64encode(creds.encode()).decode()

def relay(a, b):
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 60)
            if not r:
                break
            for s in r:
                data = s.recv(65536)
                if not data:
                    return
                (b if s is a else a).sendall(data)
    except OSError:
        pass
    finally:
        for s in (a, b):
            try: s.close()
            except OSError: pass

def handle(client):
    try:
        req = b""
        while b"\r\n\r\n" not in req:
            chunk = client.recv(4096)
            if not chunk:
                return
            req += chunk
            if len(req) > 65536:
                return
        head, _, _ = req.partition(b"\r\n\r\n")
        lines = head.decode("latin1").split("\r\n")
        method, target, _ver = lines[0].split(" ", 2)

        ups = socket.create_connection((UP_HOST, UP_PORT), timeout=30)
        if method.upper() == "CONNECT":
            out = f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
            if UP_AUTH:
                out += f"Proxy-Authorization: {UP_AUTH}\r\n"
            out += "\r\n"
            ups.sendall(out.encode())
            resp = b""
            while b"\r\n\r\n" not in resp:
                chunk = ups.recv(4096)
                if not chunk:
                    client.close(); ups.close(); return
                resp += chunk
            status = resp.split(b"\r\n", 1)[0]
            if b" 200" not in status:
                client.sendall(b"HTTP/1.1 502 Bad Gateway\r\n\r\n")
                client.close(); ups.close(); return
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            relay(client, ups)
        else:
            # plain HTTP: forward absolute-URI request as-is
            fwd = lines[0] + "\r\n"
            seen_auth = False
            for ln in lines[1:]:
                if ln.lower().startswith("proxy-authorization:"):
                    seen_auth = True
                    continue
                fwd += ln + "\r\n"
            if UP_AUTH and not seen_auth:
                fwd += f"Proxy-Authorization: {UP_AUTH}\r\n"
            fwd += "\r\n"
            ups.sendall(fwd.encode("latin1"))
            relay(client, ups)
    except Exception:
        try: client.close()
        except OSError: pass

def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(LISTEN)
    srv.listen(100)
    print(f"forward proxy on {LISTEN[0]}:{LISTEN[1]} -> {UP_HOST}:{UP_PORT}", flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()

if __name__ == "__main__":
    main()
