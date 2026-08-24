CREATE OR REPLACE FUNCTION upsert_order_transactional(order_data jsonb, items_data jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_version int;
    new_version int := (order_data->>'version')::int;
    o_id uuid := (order_data->>'id')::uuid;
    item jsonb;
BEGIN
    -- 1. Check optimistic locking if order exists
    SELECT version INTO current_version FROM orders WHERE id = o_id FOR UPDATE;
    
    IF FOUND THEN
        IF current_version >= new_version THEN
            RAISE EXCEPTION 'Optimistic locking failure: current version (%) is greater than or equal to new version (%)', current_version, new_version
            USING ERRCODE = 'P0001'; -- raise custom exception code
        END IF;
    END IF;

    -- 2. Upsert order
    INSERT INTO orders (
        id, order_number, customer_id, tenant_id, status, subtotal, tax_amount, 
        discount_amount, shipping_cost, total_amount, shipping_address, 
        payment_gateway_id, created_at, updated_at, version
    )
    VALUES (
        o_id,
        order_data->>'order_number',
        (order_data->>'customer_id')::uuid,
        (order_data->>'tenant_id')::int,
        order_data->>'status',
        (order_data->>'subtotal')::int,
        (order_data->>'tax_amount')::int,
        (order_data->>'discount_amount')::int,
        (order_data->>'shipping_cost')::int,
        (order_data->>'total_amount')::int,
        (order_data->>'shipping_address')::jsonb,
        order_data->>'payment_gateway_id',
        (order_data->>'created_at')::timestamp,
        (order_data->>'updated_at')::timestamp,
        new_version
    )
    ON CONFLICT (id) DO UPDATE SET
        order_number = EXCLUDED.order_number,
        customer_id = EXCLUDED.customer_id,
        tenant_id = EXCLUDED.tenant_id,
        status = EXCLUDED.status,
        subtotal = EXCLUDED.subtotal,
        tax_amount = EXCLUDED.tax_amount,
        discount_amount = EXCLUDED.discount_amount,
        shipping_cost = EXCLUDED.shipping_cost,
        total_amount = EXCLUDED.total_amount,
        shipping_address = EXCLUDED.shipping_address,
        payment_gateway_id = EXCLUDED.payment_gateway_id,
        updated_at = EXCLUDED.updated_at,
        version = EXCLUDED.version;

    -- 3. Upsert items
    FOR item IN SELECT * FROM jsonb_array_elements(items_data)
    LOOP
        INSERT INTO order_items (
            id, order_id, product_id, product_name, quantity, 
            unit_price, variant_id, sku, subtotal
        )
        VALUES (
            (item->>'id')::uuid,
            (item->>'order_id')::uuid,
            (item->>'product_id')::uuid,
            item->>'product_name',
            (item->>'quantity')::int,
            (item->>'unit_price')::int,
            item->>'variant_id',
            item->>'sku',
            (item->>'subtotal')::int
        )
        ON CONFLICT (id) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            unit_price = EXCLUDED.unit_price,
            subtotal = EXCLUDED.subtotal,
            variant_id = EXCLUDED.variant_id;
    END LOOP;

    -- 4. Delete items that were removed from the aggregate
    IF jsonb_array_length(items_data) >= 0 THEN
        DELETE FROM order_items 
        WHERE order_id = o_id 
        AND id NOT IN (
            SELECT (value->>'id')::uuid 
            FROM jsonb_array_elements(items_data)
        );
    END IF;

END;
$$;
