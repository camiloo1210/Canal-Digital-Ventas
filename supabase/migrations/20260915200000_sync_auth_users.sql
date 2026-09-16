-- Migration: sync_auth_users
-- Description: Adds FK to core.users and Secure Sync Trigger for identities.

-- 1. Añadir la llave foránea para asegurar integridad referencial estricta
ALTER TABLE core.users
ADD CONSTRAINT fk_core_users_auth_id
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- 2. Función SECURITY DEFINER con search_path seguro
CREATE OR REPLACE FUNCTION core.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO core.users (
    id,
    email,
    status,
    first_name,
    last_name,
    created_at,
    updated_at,
    version
  )
  VALUES (
    NEW.id,
    NEW.email,
    'active',
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    '',
    NOW(),
    NOW(),
    1
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Trigger en auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION core.handle_new_user();
