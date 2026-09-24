import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL);
async function run() {
  try {
    console.log('ALTER TABLE');
    await sql.unsafe(`ALTER TABLE core.tenants ADD COLUMN IF NOT EXISTS description VARCHAR(255) NULL, ADD COLUMN IF NOT EXISTS banner_url VARCHAR(1024) NULL;`);
    
    console.log('CREATE');
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug_v2(p_tenant_slug text)
      RETURNS TABLE (
        name varchar,
        slug varchar,
        description varchar,
        logo_url varchar,
        banner_url varchar
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = ''
      AS $$
        SELECT 
          t.name, 
          t.slug, 
          t.description, 
          t.logo_url, 
          t.banner_url
        FROM core.tenants t
        WHERE t.slug = p_tenant_slug 
          AND t.status = 'active';
      $$;
    `);
    
    console.log('GRANTS');
    await sql`REVOKE ALL ON FUNCTION public.get_public_tenant_by_slug_v2(text) FROM PUBLIC;`;
    await sql`GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_slug_v2(text) TO anon, authenticated;`;
    
    console.log('UPSERT');
    const upsertSql = `
      CREATE OR REPLACE FUNCTION public.upsert_tenant_transactional(tenant_data jsonb)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $$
      DECLARE
          v_id uuid;
          v_version int;
          v_existing_version int;
      BEGIN
          v_id := (tenant_data->>'id')::uuid;
          v_version := (tenant_data->>'version')::int;

          SELECT version INTO v_existing_version
          FROM core.tenants
          WHERE id = v_id;

          IF FOUND THEN
              IF v_existing_version >= v_version THEN
                  RAISE EXCEPTION 'Optimistic locking failed' USING ERRCODE = 'P0001';
              END IF;

              UPDATE core.tenants
              SET
                  name = (tenant_data->>'name'),
                  slug = (tenant_data->>'slug'),
                  contact_email = (tenant_data->>'contact_email'),
                  base_currency = (tenant_data->>'base_currency'),
                  status = (tenant_data->>'status'),
                  tax_id = (tenant_data->>'tax_id'),
                  custom_domain = (tenant_data->>'custom_domain'),
                  logo_url = (tenant_data->>'logo_url'),
                  banner_url = (tenant_data->>'banner_url'),
                  description = (tenant_data->>'description'),
                  updated_at = NOW(),
                  version = v_version
              WHERE id = v_id;
          ELSE
              INSERT INTO core.tenants (
                  id, name, slug, contact_email, base_currency, status, tax_id, custom_domain, logo_url, banner_url, description, created_at, updated_at, version
              )
              VALUES (
                  v_id,
                  (tenant_data->>'name'),
                  (tenant_data->>'slug'),
                  (tenant_data->>'contact_email'),
                  (tenant_data->>'base_currency'),
                  (tenant_data->>'status'),
                  (tenant_data->>'tax_id'),
                  (tenant_data->>'custom_domain'),
                  (tenant_data->>'logo_url'),
                  (tenant_data->>'banner_url'),
                  (tenant_data->>'description'),
                  NOW(),
                  NOW(),
                  v_version
              );
          END IF;
      END;
      $$;
    `;
    await sql.unsafe(upsertSql);
    
    console.log('Done');
  } catch (e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
