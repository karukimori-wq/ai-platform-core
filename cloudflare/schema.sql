CREATE TABLE IF NOT EXISTS platform_kv (
  namespace TEXT NOT NULL,
  id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (namespace, id)
);
CREATE INDEX IF NOT EXISTS idx_platform_kv_namespace_updated ON platform_kv(namespace, updated_at DESC);
