-- Supabase membuka tabel di skema public lewat Data API (PostgREST).
-- Nyalakan RLS TANPA policy: akses lewat API publik (anon/authenticated)
-- ditolak total. Server Express tetap bisa akses karena tersambung sebagai
-- pemilik tabel (role postgres) yang tidak terkena RLS.
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
