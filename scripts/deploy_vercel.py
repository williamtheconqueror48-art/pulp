#!/usr/bin/env python3
"""Deploy Pulp (Next.js) to Vercel.

- Creates/links Vercel project `pulp` to williamtheconqueror48-art/pulp on GitHub.
- Fetches the Neon pooled DATABASE_URL in-memory (validated, never logged) and
  sets it as an encrypted env var for production+preview+development.
- Disables Deployment Protection SSO so the site is public.
- Deploys from git main, waits for READY, curl-checks the live URL.

Auth: stored custom.vercel / custom.neon connectors via authd surrogates.
"""
from __future__ import annotations
import importlib.util, json, subprocess, sys, time, urllib.request, urllib.error

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response, DynamicCredentialError

VCRED, VAPI = "custom.vercel", "https://api.vercel.com"
VH = ["api.vercel.com"]
PROJECT, REPO = "pulp", "williamtheconqueror48-art/pulp"

def vapi(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(VAPI + path, data=data, method=method)
    if payload is not None: req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    add_surrogate_to_request(req, VCRED, allowed_hosts=VH)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return {} if resp.status == 204 else read_json_response(resp)
    except urllib.error.HTTPError as e:
        raise DynamicCredentialError(f"Vercel {method} {path} -> {e.code}: {e.read().decode()[:400]}")

def neon_uri():
    spec = importlib.util.spec_from_file_location(
        "neon_setup", "/home/hatch/workspace/skills/neon/bin/neon-setup.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    project = mod.find_or_create_project("pulp")
    uri = mod.connection_uri(project["id"])
    # Prefer the pooled endpoint: <id>.<region>.aws.neon.tech -> <id>-pooler.<region>.aws.neon.tech
    import re
    m = re.match(r"(postgresql://[^@]+@)([a-z0-9-]+)(\.[a-z0-9-]+\.aws\.neon\.tech)(.*)", uri)
    if m and not m.group(2).endswith("-pooler"):
        pooled = f"{m.group(1)}{m.group(2)}-pooler{m.group(3)}{m.group(4)}"
        if validate_uri(pooled):
            print("using pooled Neon URI (validated)")
            return pooled
    print("using direct Neon URI")
    return uri

def validate_uri(uri):
    payload = json.dumps({"uri": uri, "actions": [
        {"sql": "SELECT 1 AS ok", "params": [], "returns": "rows"}]})
    proc = subprocess.run(["node", "/home/hatch/workspace/skills/neon/bin/neon-exec.js"],
                          input=payload.encode(), capture_output=True, timeout=60)
    if proc.returncode != 0: return False
    try: return json.loads(proc.stdout.decode()).get("ok") is True
    except Exception: return False

def upsert_env(pid, key, value):
    envs = vapi("GET", f"/v10/projects/{pid}/env").get("envs", [])
    for e in envs:
        if e["key"] == key:
            vapi("PATCH", f"/v10/projects/{pid}/env/{e['id']}", {"value": value, "type": "encrypted"})
            print(f"env {key} updated ({e['id'][:8]})")
            return
    vapi("POST", f"/v10/projects/{pid}/env",
         {"key": key, "value": value, "type": "encrypted",
          "target": ["production", "preview", "development"]})
    print(f"env {key} created (encrypted, all targets)")

def wait_ready(dep_id, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        d = vapi("GET", f"/v13/deployments/{dep_id}")
        st = d.get("status") or d.get("readyState")
        print(f"  deployment {dep_id}: {st}")
        if st == "READY": return d
        if st in ("ERROR", "CANCELED"): raise RuntimeError(f"deploy failed: {st}")
        time.sleep(12)
    raise TimeoutError("deploy not ready in time")

def main():
    me = vapi("GET", "/v2/user")["user"]
    print("vercel authenticated as:", me.get("username"))
    try:
        proj = vapi("GET", f"/v10/projects/{PROJECT}")
        print("project exists:", PROJECT)
    except DynamicCredentialError as e:
        if "404" not in str(e): raise
        try:
            proj = vapi("POST", "/v10/projects",
                        {"name": PROJECT, "gitRepository": {"type": "github", "repo": REPO}})
            print("project created with GitHub link")
        except DynamicCredentialError as e2:
            print("git link failed; creating unlinked:", str(e2)[:120])
            proj = vapi("POST", "/v10/projects", {"name": PROJECT})
    pid = proj["id"]
    vapi("PATCH", f"/v9/projects/{pid}", {"ssoProtection": None})
    print("ssoProtection disabled (public)")

    db_url = neon_uri()          # in memory only from here on
    upsert_env(pid, "DATABASE_URL", db_url)
    del db_url

    link = proj.get("link") or {}
    if link.get("repoId"):
        dep = vapi("POST", "/v13/deployments",
                   {"name": PROJECT, "project": pid, "target": "production",
                    "gitSource": {"type": "github", "repoId": link["repoId"], "ref": "main"}})
        print("deploying from git main…")
    else:
        raise RuntimeError("project has no GitHub link; link it and re-run")
    d = wait_ready(dep["id"])
    url = d.get("url")
    print("LIVE:", f"https://{url}")
    r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
                        f"https://{url}/"], capture_output=True, text=True, timeout=60)
    print("public check HTTP:", r.stdout.strip())

if __name__ == "__main__":
    main()
