import { NextRequest, NextResponse } from "next/server";
import { ensureDevice, getPool, validDeviceId, validDocType } from "../../../lib/db";

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

// GET /api/projects — list this device's projects, newest first
export async function GET(req: NextRequest) {
  const did = deviceId(req);
  if (!did) return NextResponse.json({ error: "x-device-id required" }, { status: 400 });
  await ensureDevice(did);
  const { rows } = await getPool().query(
    `SELECT id, title, doc_type, content, title_page, created_at, updated_at
     FROM projects WHERE device_id = $1 ORDER BY updated_at DESC`,
    [did]
  );
  return NextResponse.json(rows.map(pack));
}

// POST /api/projects — create (client may supply id for offline-first sync)
export async function POST(req: NextRequest) {
  const did = deviceId(req);
  if (!did) return NextResponse.json({ error: "x-device-id required" }, { status: 400 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !validDocType(body.doc_type)) {
    return NextResponse.json({ error: "title and valid doc_type required" }, { status: 422 });
  }
  const id = validDeviceId(body.id) ? body.id : undefined;
  await ensureDevice(did);
  const { rows } = await getPool().query(
    `INSERT INTO projects (id, device_id, title, doc_type, content, title_page)
     VALUES (COALESCE($2, gen_random_uuid()), $1, $3, $4, $5::jsonb, COALESCE($6::jsonb, '{}'::jsonb))
     ON CONFLICT (id) DO NOTHING
     RETURNING id, title, doc_type, content, title_page, created_at, updated_at`,
    [
      did,
      id ?? null,
      body.title.slice(0, 200),
      body.doc_type,
      JSON.stringify(body.content ?? { blocks: [] }),
      body.title_page ? JSON.stringify(body.title_page) : null,
    ]
  );
  if (!rows.length) {
    // id already existed (e.g. retried sync) — return the existing row if ours
    const existing = await getPool().query(
      `SELECT id, title, doc_type, content, title_page, created_at, updated_at
       FROM projects WHERE id = $1 AND device_id = $2`,
      [id, did]
    );
    if (!existing.rows.length)
      return NextResponse.json({ error: "project exists under another device" }, { status: 409 });
    return NextResponse.json(pack(existing.rows[0]));
  }
  return NextResponse.json(pack(rows[0]), { status: 201 });
}
