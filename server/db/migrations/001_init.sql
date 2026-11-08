-- Perangkat kiosk (tablet). Token disimpan sebagai hash SHA-256, bukan teks asli.
CREATE TABLE devices (
  code            text PRIMARY KEY CHECK (code ~ '^[A-Z]$'),
  name            text NOT NULL,
  token_hash      text NOT NULL UNIQUE,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- diisi oleh heartbeat kiosk
  last_seen       timestamptz,
  printer_status  text,
  print_count     integer NOT NULL DEFAULT 0,
  upload_queue    integer NOT NULL DEFAULT 0
);

-- Satu sesi = satu pengunjung (struk + 3 foto).
CREATE TABLE sessions (
  id            text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{8,16}$'),
  device_code   text NOT NULL REFERENCES devices (code),
  receipt_no    text NOT NULL,
  template_id   text NOT NULL,
  status        text NOT NULL DEFAULT 'uploading'
                CHECK (status IN ('uploading', 'ready', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  expires_at    timestamptz NOT NULL
);

CREATE INDEX sessions_status_created_idx ON sessions (status, created_at);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
-- Nomor struk tidak dibuat unik: kalau data tablet terhapus, hitungan bisa
-- terulang, dan itu tidak boleh menggagalkan upload.
CREATE INDEX sessions_device_created_idx ON sessions (device_code, created_at);
