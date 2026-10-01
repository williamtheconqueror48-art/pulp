-- PULP schema — Neon Postgres
-- Anonymous devices own projects; every project row is scoped to its device_id.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('screenplay', 'poem', 'song')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  title_page JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_device_id_idx ON projects (device_id);
CREATE INDEX IF NOT EXISTS projects_updated_at_idx ON projects (device_id, updated_at DESC);
