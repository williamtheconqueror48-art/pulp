#!/usr/bin/env python3
"""Push ~/workspace/pulp to GitHub williamtheconqueror48-art/pulp via Git Data API.

- Creates the repo if missing.
- First run: builds the full tree, creates the initial commit, POSTs refs/heads/main.
- Later runs: replicates local commits on top of origin/main (diff-based).

Auth: stored custom.github connector via authd surrogates. api.github.com only.
"""
from __future__ import annotations
import base64, json, os, subprocess, sys, urllib.request, urllib.error

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response, DynamicCredentialError

CRED, API = "custom.github", "https://api.github.com"
HOSTS = ["api.github.com"]
REPO_DIR = "/home/hatch/workspace/pulp"
OWNER, REPO = "williamtheconqueror48-art", "pulp"
SKIP = {"node_modules", ".git", ".next", "__pycache__", ".vercel"}

def api(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    if payload is not None: req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    req.add_header("User-Agent", "pulp-push/1.0")
    add_surrogate_to_request(req, CRED, allowed_hosts=HOSTS)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return {} if resp.status == 204 else read_json_response(resp)
    except urllib.error.HTTPError as e:
        raise DynamicCredentialError(f"GitHub {method} {path} -> {e.code}: {e.read().decode()[:400]}")

def sh(*a):
    return subprocess.run(a, cwd=REPO_DIR, capture_output=True, text=True, check=True).stdout.strip()

def collect():
    out = []
    for dp, dn, fn in os.walk(REPO_DIR):
        dn[:] = [d for d in dn if d not in SKIP]
        for f in fn:
            full = os.path.join(dp, f)
            rel = os.path.relpath(full, REPO_DIR)
            with open(full, "rb") as fh: out.append((rel, fh.read()))
    return sorted(out)

def main():
    me = api("GET", "/user")["login"]
    assert me == OWNER, f"authenticated as {me}, expected {OWNER}"
    try:
        api("GET", f"/repos/{OWNER}/{REPO}")
        print("repo exists")
    except DynamicCredentialError as e:
        if "404" not in str(e): raise
        api("POST", "/user/repos", {"name": REPO, "private": False,
            "description": "PULP — a free studio for screenplays, poems & songs. Unlimited scripts, industry formatting, zero cost.",
            "topics": ["screenwriting", "screenplay", "writing", "fountain", "nextjs", "free-software"]})
        print("repo created")
    if not os.path.isdir(f"{REPO_DIR}/.git"):
        sh("git", "init", "-q"); sh("git", "add", "-A")
        sh("git", "-c", "user.name=pulp", "-c", "user.email=pulp@local", "commit", "-qm", "Pulp: free screenwriting studio (Next.js + Neon)")
    try:
        ref = api("GET", f"/repos/{OWNER}/{REPO}/git/refs/heads/main")
        base_sha = ref["object"]["sha"]
        print("origin/main =", base_sha[:8])
        base_tree = api("GET", f"/repos/{OWNER}/{REPO}/git/commits/{base_sha}")["tree"]["sha"]
        parents = [base_sha]
        msg = "Pulp: sync working tree"
    except DynamicCredentialError as e:
        if "404" not in str(e) and "409" not in str(e): raise
        print("no remote main yet — initial commit")
        base_tree, parents = None, []
        msg = "Pulp: free screenwriting studio (Next.js + Neon)"
    # Full-tree push on top of remote main (robust to local history divergence).
    entries = []
    for rel, content in collect():
        blob = api("POST", f"/repos/{OWNER}/{REPO}/git/blobs",
                   {"content": base64.b64encode(content).decode(), "encoding": "base64"})
        entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": blob["sha"]})
    print(f"blobs: {len(entries)}")
    payload = {"tree": entries}
    if base_tree: payload["base_tree"] = base_tree
    tree = api("POST", f"/repos/{OWNER}/{REPO}/git/trees", payload)
    commit = api("POST", f"/repos/{OWNER}/{REPO}/git/commits",
                 {"message": msg, "tree": tree["sha"], "parents": parents})
    if parents:
        api("PATCH", f"/repos/{OWNER}/{REPO}/git/refs/heads/main", {"sha": commit["sha"]})
    else:
        api("POST", f"/repos/{OWNER}/{REPO}/git/refs",
            {"ref": "refs/heads/main", "sha": commit["sha"]})
    print(f"pushed {commit['sha'][:8]} -> main")

if __name__ == "__main__":
    main()
