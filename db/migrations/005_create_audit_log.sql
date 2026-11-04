CREATE TABLE public.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_key TEXT NOT NULL,
    action TEXT NOT NULL
        CHECK (action IN ('CREATED', 'EDITED', 'DELETED', 'RESTORED')),
    app_user TEXT NOT NULL,
    db_user TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    old_values JSONB,
    new_values JSONB,
    CONSTRAINT audit_log_sensitive_values_check CHECK (
        (old_values IS NULL OR NOT old_values ?| ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'])
        AND
        (new_values IS NULL OR NOT new_values ?| ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'])
    )
);

CREATE INDEX audit_log_table_record_idx
    ON public.audit_log (table_name, record_key, id);
CREATE INDEX audit_log_occurred_at_idx
    ON public.audit_log (occurred_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.audit_user()
RETURNS TEXT
LANGUAGE SQL
STABLE
SET search_path = pg_catalog
AS $$
    SELECT COALESCE(
        NULLIF(btrim(current_setting('app.current_user', TRUE)), ''),
        'system'
    );
$$;

CREATE FUNCTION public.audit_set_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    actor TEXT := public.audit_user();
    action_name TEXT;
    old_status TEXT;
    new_status TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_name := 'CREATED';
    ELSE
        old_status := to_jsonb(OLD) ->> 'status';
        new_status := to_jsonb(NEW) ->> 'status';
        IF old_status = 'Active' AND new_status = 'Inactive' THEN
            action_name := 'DELETED';
        ELSIF old_status = 'Inactive' AND new_status = 'Active' THEN
            action_name := 'RESTORED';
        ELSE
            action_name := 'EDITED';
        END IF;
    END IF;

    NEW.stamp := format(
        '%s %s %s',
        action_name,
        actor,
        to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD FMHH12:MI AM')
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_record_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    actor TEXT := public.audit_user();
    action_name TEXT;
    old_row JSONB;
    new_row JSONB;
    key_row JSONB := '{}'::JSONB;
    record_key_value TEXT;
    old_status TEXT;
    new_status TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_name := 'CREATED';
        new_row := to_jsonb(NEW)
            - ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'];
        key_row := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        action_name := 'DELETED';
        old_row := to_jsonb(OLD)
            - ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'];
        key_row := to_jsonb(OLD);
    ELSE
        old_status := to_jsonb(OLD) ->> 'status';
        new_status := to_jsonb(NEW) ->> 'status';
        IF old_status = 'Active' AND new_status = 'Inactive' THEN
            action_name := 'DELETED';
        ELSIF old_status = 'Inactive' AND new_status = 'Active' THEN
            action_name := 'RESTORED';
        ELSE
            action_name := 'EDITED';
        END IF;
        old_row := to_jsonb(OLD)
            - ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'];
        new_row := to_jsonb(NEW)
            - ARRAY['password_hash', 'token_hash', 'password', 'token', 'raw_token'];
        key_row := to_jsonb(NEW);
    END IF;

    SELECT jsonb_object_agg(keys.column_name, key_row -> keys.column_name)::TEXT
      INTO record_key_value
      FROM unnest(TG_ARGV) AS keys(column_name);

    INSERT INTO public.audit_log (
        table_name, record_key, action, app_user, db_user,
        occurred_at, old_values, new_values
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(record_key_value, '{}'),
        action_name,
        actor,
        SESSION_USER,
        CURRENT_TIMESTAMP,
        old_row,
        new_row
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.audit_log_block_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'public.audit_log is append-only; UPDATE, DELETE, and TRUNCATE are forbidden.'
        USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER audit_log_no_update_delete
    BEFORE UPDATE OR DELETE ON public.audit_log
    FOR EACH ROW EXECUTE FUNCTION public.audit_log_block_mutation();
CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON public.audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_block_mutation();

REVOKE ALL ON TABLE public.audit_log FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC;

DO $$
DECLARE
    application_role TEXT;
BEGIN
    FOREACH application_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'hope_app'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = application_role) THEN
            EXECUTE format(
                'REVOKE ALL ON TABLE public.audit_log FROM %I',
                application_role
            );
            EXECUTE format(
                'REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM %I',
                application_role
            );
        END IF;
    END LOOP;
END;
$$;

DO $$
DECLARE
    table_record RECORD;
    primary_key_columns TEXT[];
    trigger_arguments TEXT;
BEGIN
    FOR table_record IN
        SELECT relation.oid,
               relation.relname AS table_name,
               namespace.nspname AS schema_name
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        JOIN pg_attribute AS status_column
          ON status_column.attrelid = relation.oid
         AND status_column.attname = 'status'
         AND status_column.attnum > 0
         AND NOT status_column.attisdropped
        JOIN pg_attribute AS stamp_column
          ON stamp_column.attrelid = relation.oid
         AND stamp_column.attname = 'stamp'
         AND stamp_column.attnum > 0
         AND NOT stamp_column.attisdropped
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p')
          AND relation.relname <> 'audit_log'
        ORDER BY relation.relname
    LOOP
        SELECT array_agg(attribute.attname ORDER BY key_column.ordinality)
          INTO primary_key_columns
          FROM pg_index AS primary_key
          CROSS JOIN LATERAL unnest(primary_key.indkey) WITH ORDINALITY
              AS key_column(attnum, ordinality)
          JOIN pg_attribute AS attribute
            ON attribute.attrelid = primary_key.indrelid
           AND attribute.attnum = key_column.attnum
         WHERE primary_key.indrelid = table_record.oid
           AND primary_key.indisprimary;

        IF primary_key_columns IS NULL OR cardinality(primary_key_columns) = 0 THEN
            RAISE EXCEPTION
                'Cannot audit %.%: a status/stamp table must have a primary key.',
                table_record.schema_name, table_record.table_name;
        END IF;

        trigger_arguments := (
            SELECT string_agg(format('%L', keys.column_name), ', ')
            FROM unnest(primary_key_columns) AS keys(column_name)
        );

        EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN stamp TYPE TEXT',
            table_record.schema_name, table_record.table_name
        );

        EXECUTE format(
            'CREATE TRIGGER %I
             BEFORE INSERT OR UPDATE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION public.audit_set_stamp()',
            'zz_audit_stamp_' || table_record.table_name,
            table_record.schema_name,
            table_record.table_name
        );
        EXECUTE format(
            'CREATE TRIGGER %I
             AFTER INSERT OR UPDATE OR DELETE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION public.audit_record_change(%s)',
            'zz_audit_log_' || table_record.table_name,
            table_record.schema_name,
            table_record.table_name,
            trigger_arguments
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_set_stamp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_record_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_log_block_mutation() FROM PUBLIC;

COMMENT ON TABLE public.audit_log IS
    'Append-only row change history. app_user is the trusted application identity from transaction-local app.current_user; db_user is SESSION_USER.';
COMMENT ON COLUMN public.audit_log.record_key IS
    'JSON object containing the primary-key column values for the changed row.';
COMMENT ON COLUMN public.audit_log.app_user IS
    'Authenticated application identity from app.current_user, or system if absent.';
COMMENT ON COLUMN public.audit_log.db_user IS
    'PostgreSQL session login for forensic context; not the application user.';
COMMENT ON COLUMN public.audit_log.old_values IS
    'Prior row values excluding password_hash, token_hash, password, token, and raw_token.';
COMMENT ON COLUMN public.audit_log.new_values IS
    'New row values excluding password_hash, token_hash, password, token, and raw_token.';
COMMENT ON FUNCTION public.audit_user() IS
    'Returns transaction-local app.current_user or system when unset/blank. Set identity only from trusted authenticated backend code.';
