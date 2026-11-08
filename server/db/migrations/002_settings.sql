-- Pengaturan umum (mis. key 'print' = pengaturan hasil cetak untuk semua kiosk).
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Pengaturan cetak khusus satu kiosk (mis. printernya lebih gelap).
-- NULL = ikut pengaturan umum.
ALTER TABLE devices ADD COLUMN print_settings jsonb;
