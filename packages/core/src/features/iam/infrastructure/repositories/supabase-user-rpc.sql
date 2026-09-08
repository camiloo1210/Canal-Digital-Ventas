-- Function to perform transactional upsert with optimistic locking for users
CREATE OR REPLACE FUNCTION public.upsert_user_transactional(
    user_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_version int;
BEGIN
    -- Check if the user exists and get its current version
    SELECT version INTO current_version
    FROM public.users
    WHERE id = (user_data->>'id')::uuid;

    IF FOUND THEN
        -- Optimistic locking check
        IF current_version != (user_data->>'version')::int THEN
            RAISE EXCEPTION 'Optimistic locking failed: user has been modified' USING ERRCODE = 'P0001';
        END IF;

        -- Update the user and increment the version
        UPDATE public.users
        SET
            tenant_id = (user_data->>'tenant_id')::uuid,
            email = user_data->>'email',
            first_name = user_data->>'first_name',
            last_name = user_data->>'last_name',
            role = user_data->>'role',
            permissions = (user_data->>'permissions')::jsonb,
            status = user_data->>'status',
            updated_at = NOW(),
            version = current_version + 1
        WHERE id = (user_data->>'id')::uuid;
    ELSE
        -- Insert a new user (version naturally starts at 0 or whatever was sent, usually 0)
        INSERT INTO public.users (
            id,
            tenant_id,
            email,
            first_name,
            last_name,
            role,
            permissions,
            status,
            created_at,
            updated_at,
            version
        ) VALUES (
            (user_data->>'id')::uuid,
            (user_data->>'tenant_id')::uuid,
            user_data->>'email',
            user_data->>'first_name',
            user_data->>'last_name',
            user_data->>'role',
            (user_data->>'permissions')::jsonb,
            user_data->>'status',
            (user_data->>'created_at')::timestamp with time zone,
            (user_data->>'updated_at')::timestamp with time zone,
            (user_data->>'version')::int
        );
    END IF;
END;
$$;
