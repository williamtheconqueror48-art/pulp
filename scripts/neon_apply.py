#!/usr/bin/env python3
"""Apply ~/workspace/pulp/schema.sql to the Neon 'pulp' project and verify tables.

Reuses the neon skill's API helpers; the connection URI travels to the node
child over a stdin pipe only — in memory, never logged, printed, or persisted.
"""
from __future__ import annotations
import importlib.util, json, re, subprocess, sys

SKILL_BIN = "/home/hatch/workspace/skills/neon/bin"
SCHEMA = "/home/hatch/workspace/pulp/schema.sql"
EXEC_JS = f"{SKILL_BIN}/neon-exec.js"
WANT = ["devices", "projects"]

spec = importlib.util.spec_from_file_location("neon_setup", f"{SKILL_BIN}/neon-setup.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def run_actions(uri, actions):
    payload = json.dumps({"uri": uri, "actions": actions})
    proc = subprocess.run(["node", EXEC_JS], input=payload.encode(),
                          capture_output=True, timeout=180)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.decode()[:400])
    out = json.loads(proc.stdout.decode())
    if not out.get("ok"):
        raise RuntimeError(out.get("error"))
    return out["results"]

def main():
    project = mod.find_or_create_project("pulp")
    uri = mod.connection_uri(project["id"])
    with open(SCHEMA, encoding="utf-8") as f:
        sql = f.read()
    # strip -- line comments, then split on semicolons
    sql = re.sub(r"--[^\n]*", "", sql)
    stmts = [s.strip() for s in sql.split(";") if s.strip()]
    actions = [{"sql": s, "params": [], "returns": "none"} for s in stmts]
    actions.append({"sql": ("SELECT tablename FROM pg_tables WHERE schemaname='public' "
                            "AND tablename IN ('devices','projects') ORDER BY tablename"),
                    "params": [], "returns": "rows"})
    results = run_actions(uri, actions)
    tables = sorted(r["tablename"] for r in results[-1])
    print("tables verified:", ", ".join(tables))
    assert tables == WANT, f"schema incomplete: {tables}"
    print("Neon database ready for project pulp")

if __name__ == "__main__":
    main()
