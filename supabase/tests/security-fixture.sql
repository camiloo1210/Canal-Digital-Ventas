-- Minimal Supabase platform interfaces for an isolated, disposable native PostgreSQL cluster.
-- Application tables, policies and RPCs are loaded from the actual migration files.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOLOGIN SUPERUSER; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, email text NOT NULL,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}', raw_app_meta_data jsonb NOT NULL DEFAULT '{}',
  banned_until timestamptz
);
CREATE TABLE auth.sessions (user_id uuid);
CREATE TABLE auth.refresh_tokens (user_id text);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name,'/') $$;
GRANT USAGE ON SCHEMA storage TO authenticated,anon;
GRANT SELECT,INSERT,DELETE ON storage.objects TO authenticated;
