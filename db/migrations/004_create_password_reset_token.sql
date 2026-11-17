CREATE TABLE public.password_reset_token (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES public.app_user (id) ON DELETE RESTRICT,
    token_hash VARCHAR(64) NOT NULL UNIQUE
        CONSTRAINT password_reset_token_hash_format_check
            CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    purpose VARCHAR(20) NOT NULL
        CONSTRAINT password_reset_token_purpose_check
            CHECK (purpose IN ('set_password', 'reset_password')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    requested_ip INET,
    status VARCHAR(8) NOT NULL DEFAULT 'Active'
        CONSTRAINT password_reset_token_status_check
            CHECK (status IN ('Active', 'Inactive')),
    stamp VARCHAR(80) NOT NULL
        DEFAULT ('CREATED system ' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD FMHH12:MI AM')),
    CONSTRAINT password_reset_token_expiry_check
        CHECK (expires_at > created_at)
);

CREATE INDEX password_reset_token_user_idx
    ON public.password_reset_token (user_id);
CREATE INDEX password_reset_token_expires_at_idx
    ON public.password_reset_token (expires_at);
CREATE UNIQUE INDEX password_reset_token_open_user_purpose_uq
    ON public.password_reset_token (user_id, purpose)
    WHERE used_at IS NULL AND status = 'Active';

ALTER TABLE public.password_reset_token ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.password_reset_token IS 'Single-use, expiring password setup/reset tokens; the raw token is never stored.';
COMMENT ON COLUMN public.password_reset_token.token_hash IS 'Lowercase hexadecimal SHA-256 digest of the raw URL-safe token.';
COMMENT ON COLUMN public.password_reset_token.purpose IS 'Whether this token sets an initial password or resets an existing password.';
COMMENT ON COLUMN public.password_reset_token.expires_at IS 'Absolute expiry selected by application configuration; must be later than created_at.';
COMMENT ON COLUMN public.password_reset_token.used_at IS 'NULL while unused; otherwise records when consumed or invalidated, preserving lifecycle time.';
COMMENT ON COLUMN public.password_reset_token.requested_ip IS 'Optional IP address that requested the token; retain only as needed for security.';
COMMENT ON COLUMN public.password_reset_token.status IS 'Soft status; inactive rows cannot validate, while expired/used rows may later be purged.';
COMMENT ON COLUMN public.password_reset_token.stamp IS 'Latest token-record action, actor, and time; not a full audit history.';
