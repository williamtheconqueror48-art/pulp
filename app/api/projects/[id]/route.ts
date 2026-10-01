import { NextRequest, NextResponse } from "next/server";
import { ensureDevice, getPool, validDeviceId, validDocType } from "../../../../../lib/db";

export const runtime = "nodejs";

function deviceId(req: NextRequest): string | null {
  const v = req.headers.get("x-device-id");
  return validDeviceId(v) ? v : null;
}

function pack(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    doc_type: row.doc_type,
    content: row.content,
    title_page: row.title_page,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function owned(did: string, id: string) {
  const { rows } = await getPool().query(
    `SELECT id, title, doc_type, content, title_page, created_at, updated_at
     FROM projects WHERE id = $1 AND device_id = $2`,
    [id, did]
  );
  return rows[0] ?? null;
}

// GET /api/projects/[id]
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const did = deviceId(req);
  if (!did) return NextResponse.json({ error: "x-device-id required" }, { status: 400 });
  const { id } = await ctx.params;
  if (!validDeviceId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await ensureDevice(did);
  const row = await owned(did, id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(pack(row));
}

// PUT /api/projects/[id]
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const did = deviceId(req);
  if (!did) return NextResponse.json({ error: "x-device-id required" }, { status: 400 });
  const { id } = await ctx.params;
  if (!validDeviceId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body required" }, { status: 422 });
  await ensureDevice(did);
  const sets: string[] = ["updated_at = now()"];
  const vals: unknown[] = [id, did];
  let n = 3;
  if (typeof body.title === "string") { sets.push(`title = $${n++}`); vals.push(body.title.slice(0, 200)); }
  if (validDocType(body.doc_type)) { sets.push(`doc_type = $${n++}`); vals.push(body.doc_type); }
  if (body.content !== undefined) { sets.push(`content = $${n++}::jsonb`); vals.push(JSON.stringify(body.content)); }
  if (body.title_page !== undefined) { sets.push(`title_page = $${n++}::jsonb`); vals.push(JSON.stringify(body.title_page)); }
  const { rows } = await getPool().query(
    `UPDATE projects SET ${sets.join(", ")} WHERE id = $1 AND device_id = $2
     RETURNING id, title, doc_type, content, title_page, created_at, updated_at`,
    vals
  );
  if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(pack(rows[0]));
}

// DELETE /api/projects/[id]
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const did = deviceId(req);
  if (!did) return NextResponse.json({ error: "x-device-id required" }, { status: 400 });
  const { id } = await ctx.params;
  if (!validDeviceId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await ensureDevice(did);
  const { rowCount } = await getPool().query(
    "DELETE FROM projects WHERE id = $1 AND device_id = $2",
    [id, did]
  );
  if (!rowCount) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
