CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (char_length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(btrim(last_name)) BETWEEN 1 AND 80),
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('superadmin', 'admin', 'user')),
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

CREATE POLICY "Users can read their own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);