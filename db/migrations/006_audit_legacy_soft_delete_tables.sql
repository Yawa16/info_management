CREATE TEMP TABLE task6_saved_stamp_views
ON COMMIT DROP
AS
WITH RECURSIVE dependent_views(view_oid, depth) AS (
    SELECT DISTINCT view_relation.oid, 1
      FROM pg_class AS source_relation
      JOIN pg_namespace AS source_namespace
        ON source_namespace.oid = source_relation.relnamespace
      JOIN pg_attribute AS stamp_column
        ON stamp_column.attrelid = source_relation.oid
       AND stamp_column.attname = 'stamp'
       AND stamp_column.attnum > 0
       AND NOT stamp_column.attisdropped
      JOIN pg_depend AS dependency
        ON dependency.refobjid = source_relation.oid
       AND dependency.refobjsubid = stamp_column.attnum
       AND dependency.refclassid = 'pg_class'::REGCLASS
       AND dependency.classid = 'pg_rewrite'::REGCLASS
      JOIN pg_rewrite AS rewrite ON rewrite.oid = dependency.objid
      JOIN pg_class AS view_relation ON view_relation.oid = rewrite.ev_class
      JOIN pg_namespace AS view_namespace
        ON view_namespace.oid = view_relation.relnamespace
     WHERE source_namespace.nspname = 'public'
       AND view_namespace.nspname = 'public'
       AND source_relation.relkind IN ('r', 'p')
       AND view_relation.relkind = 'v'
       AND view_relation.oid <> source_relation.oid
       AND EXISTS (
           SELECT 1
           FROM pg_attribute AS deleted_column
           WHERE deleted_column.attrelid = source_relation.oid
             AND deleted_column.attname = 'is_deleted'
             AND deleted_column.attnum > 0
             AND NOT deleted_column.attisdropped
       )
    UNION
    SELECT rewrite.ev_class, dependent.depth + 1
      FROM dependent_views AS dependent
      JOIN pg_depend AS dependency
        ON dependency.refobjid = dependent.view_oid
       AND dependency.refclassid = 'pg_class'::REGCLASS
       AND dependency.classid = 'pg_rewrite'::REGCLASS
      JOIN pg_rewrite AS rewrite ON rewrite.oid = dependency.objid
      JOIN pg_class AS view_relation ON view_relation.oid = rewrite.ev_class
     WHERE view_relation.relkind = 'v'
       AND view_relation.oid <> dependent.view_oid
)
SELECT view_namespace.nspname AS schema_name,
       view_relation.relname AS view_name,
       MAX(dependent.depth) AS dependency_depth,
       pg_get_viewdef(view_relation.oid, TRUE) AS view_definition,
       pg_get_userbyid(view_relation.relowner) AS view_owner,
       view_relation.relacl AS view_acl,
       obj_description(view_relation.oid, 'pg_class') AS view_comment,
       view_relation.reloptions AS view_options
  FROM dependent_views AS dependent
  JOIN pg_class AS view_relation ON view_relation.oid = dependent.view_oid
  JOIN pg_namespace AS view_namespace
    ON view_namespace.oid = view_relation.relnamespace
 GROUP BY view_namespace.nspname, view_relation.oid;

DO $$
DECLARE
    saved_view RECORD;
BEGIN
    FOR saved_view IN
        SELECT schema_name, view_name
        FROM task6_saved_stamp_views
        ORDER BY dependency_depth DESC, schema_name, view_name
    LOOP
        EXECUTE format(
            'DROP VIEW %I.%I',
            saved_view.schema_name,
            saved_view.view_name
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_set_stamp()
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
    old_is_deleted BOOLEAN;
    new_is_deleted BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_name := 'CREATED';
    ELSE
        old_status := to_jsonb(OLD) ->> 'status';
        new_status := to_jsonb(NEW) ->> 'status';
        old_is_deleted := (to_jsonb(OLD) ->> 'is_deleted')::BOOLEAN;
        new_is_deleted := (to_jsonb(NEW) ->> 'is_deleted')::BOOLEAN;
        IF old_status = 'Active' AND new_status = 'Inactive' THEN
            action_name := 'DELETED';
        ELSIF old_status = 'Inactive' AND new_status = 'Active' THEN
            action_name := 'RESTORED';
        ELSIF old_is_deleted IS FALSE AND new_is_deleted IS TRUE THEN
            action_name := 'DELETED';
        ELSIF old_is_deleted IS TRUE AND new_is_deleted IS FALSE THEN
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

CREATE OR REPLACE FUNCTION public.audit_record_change()
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
    old_is_deleted BOOLEAN;
    new_is_deleted BOOLEAN;
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
        old_is_deleted := (to_jsonb(OLD) ->> 'is_deleted')::BOOLEAN;
        new_is_deleted := (to_jsonb(NEW) ->> 'is_deleted')::BOOLEAN;
        IF old_status = 'Active' AND new_status = 'Inactive' THEN
            action_name := 'DELETED';
        ELSIF old_status = 'Inactive' AND new_status = 'Active' THEN
            action_name := 'RESTORED';
        ELSIF old_is_deleted IS FALSE AND new_is_deleted IS TRUE THEN
            action_name := 'DELETED';
        ELSIF old_is_deleted IS TRUE AND new_is_deleted IS FALSE THEN
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

DO $$
DECLARE
    table_record RECORD;
    primary_key_columns TEXT[];
    trigger_arguments TEXT;
    saved_view RECORD;
    grant_record RECORD;
    view_options TEXT;
BEGIN
    FOR table_record IN
        SELECT relation.oid,
               relation.relname AS table_name,
               namespace.nspname AS schema_name
        FROM pg_class AS relation
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relkind IN ('r', 'p')
          AND relation.relname NOT IN ('audit_log', 'audit_log_legacy_task6')
          AND EXISTS (
              SELECT 1
              FROM pg_attribute AS deleted_column
              WHERE deleted_column.attrelid = relation.oid
                AND deleted_column.attname = 'is_deleted'
                AND deleted_column.attnum > 0
                AND NOT deleted_column.attisdropped
          )
          AND EXISTS (
              SELECT 1
              FROM pg_attribute AS stamp_column
              WHERE stamp_column.attrelid = relation.oid
                AND stamp_column.attname = 'stamp'
                AND stamp_column.attnum > 0
                AND NOT stamp_column.attisdropped
          )
          AND NOT EXISTS (
              SELECT 1
              FROM pg_attribute AS status_column
              WHERE status_column.attrelid = relation.oid
                AND status_column.attname = 'status'
                AND status_column.attnum > 0
                AND NOT status_column.attisdropped
          )
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
                'Cannot audit legacy soft-delete table %.%: a primary key is required.',
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
            'zz_audit_legacy_stamp_' || table_record.table_name,
            table_record.schema_name,
            table_record.table_name
        );
        EXECUTE format(
            'CREATE TRIGGER %I
             AFTER INSERT OR UPDATE OR DELETE ON %I.%I
             FOR EACH ROW EXECUTE FUNCTION public.audit_record_change(%s)',
            'zz_audit_legacy_log_' || table_record.table_name,
            table_record.schema_name,
            table_record.table_name,
            trigger_arguments
        );
    END LOOP;

    FOR saved_view IN
        SELECT *
        FROM task6_saved_stamp_views
        ORDER BY dependency_depth, schema_name, view_name
    LOOP
        EXECUTE format(
            'CREATE VIEW %I.%I AS %s',
            saved_view.schema_name,
            saved_view.view_name,
            saved_view.view_definition
        );
        EXECUTE format(
            'ALTER VIEW %I.%I OWNER TO %I',
            saved_view.schema_name,
            saved_view.view_name,
            saved_view.view_owner
        );
        IF saved_view.view_comment IS NOT NULL THEN
            EXECUTE format(
                'COMMENT ON VIEW %I.%I IS %L',
                saved_view.schema_name,
                saved_view.view_name,
                saved_view.view_comment
            );
        END IF;

        FOR grant_record IN
            SELECT exploded.grantee,
                   exploded.privilege_type,
                   exploded.is_grantable,
                   CASE
                       WHEN exploded.grantee = 0 THEN 'PUBLIC'
                       ELSE pg_get_userbyid(exploded.grantee)
                   END AS grantee_name
            FROM aclexplode(saved_view.view_acl) AS exploded
            WHERE exploded.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
        LOOP
            EXECUTE format(
                'GRANT %s ON TABLE %I.%I TO %s%s',
                grant_record.privilege_type,
                saved_view.schema_name,
                saved_view.view_name,
                CASE
                    WHEN grant_record.grantee = 0 THEN 'PUBLIC'
                    ELSE format('%I', grant_record.grantee_name)
                END,
                CASE
                    WHEN grant_record.is_grantable THEN ' WITH GRANT OPTION'
                    ELSE ''
                END
            );
        END LOOP;

        IF saved_view.view_options IS NOT NULL THEN
            SELECT string_agg(
                       format('%I = %L', split_part(option_value, '=', 1), split_part(option_value, '=', 2)),
                       ', '
                   )
              INTO view_options
              FROM unnest(saved_view.view_options) AS options(option_value);
            EXECUTE format(
                'ALTER VIEW %I.%I SET (%s)',
                saved_view.schema_name,
                saved_view.view_name,
                view_options
            );
        END IF;
    END LOOP;
END;
$$;
