-- ============================================================================
-- Forja — delete_user_account() RPC
-- ============================================================================
-- Run AFTER scripts/supabase-schema.sql: the function touches every table, so the
-- tables must already exist.
--
-- SECURITY NOTES (read before deploying):
--
--  1. REVOKE ... FROM PUBLIC is mandatory. A new function is created with EXECUTE
--     granted to PUBLIC by default, so WITHOUT the revoke ANY caller holding the
--     public publishable key (the `anon` role) could invoke it. We revoke from
--     PUBLIC and grant only to `authenticated`.
--
--  2. The function takes NO arguments and derives the target user from auth.uid(),
--     so a signed-in user can only ever delete their OWN account. Never add a uid
--     parameter: with SECURITY DEFINER that would let any user delete any account.
--
--  3. SECURITY DEFINER is required ONLY for the final DELETE FROM auth.users — the
--     `authenticated` role has no privileges on the auth schema. As the owner, the
--     function also bypasses Row Level Security, which means the explicit
--     `WHERE ... user_id = uid` filters below are the ONLY thing that keeps one
--     user's call from deleting another user's rows. Keep them.
--
--  4. Deleting from auth.users inside a SECURITY DEFINER function is a known sharp
--     edge: it runs with the definer's (owner's) privileges and skips GoTrue's own
--     cleanup path. Supabase's supported approach is an Edge Function using the
--     service-role key and the Admin API (auth.admin.deleteUser), which also cleans
--     up auth side-data (identities, sessions, refresh tokens). This function is
--     kept because it works today, but if you can move account deletion to such an
--     Edge Function, do that and drop the final DELETE below. `is_super_admin`-style
--     checks are not appropriate here: the caller deletes themselves.
-- ============================================================================

-- Apply atomically: the function and its GRANT/REVOKE pair either both land or neither
-- does. A function that exists with the default PUBLIC grant is the bug this file exists
-- to prevent, so it must never be observable in that state.
BEGIN;

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- needed for the auth.users delete AND to bypass RLS on deletes
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  -- Refuse to run without an authenticated caller. Without this, auth.uid() is
  -- NULL and every `WHERE user_id = uid` would match nothing (safe, but silent).
  IF uid IS NULL THEN
    RAISE EXCEPTION 'delete_user_account: no authenticated user';
  END IF;

  -- Delete in dependency order. The user_id foreign keys also cascade from
  -- auth.users (and children cascade from their parents), but doing it explicitly
  -- keeps the function correct even if a cascade is ever removed, and it clears the
  -- *_exercises rows BEFORE the RESTRICT on exercises, so a custom exercise can be
  -- deleted without being blocked by the workout history that referenced it.
  DELETE FROM sets WHERE session_exercise_id IN (
    SELECT se.id FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE s.user_id = uid
  );

  DELETE FROM session_exercises WHERE session_id IN (
    SELECT id FROM sessions WHERE user_id = uid
  );

  DELETE FROM sessions WHERE user_id = uid;

  DELETE FROM routine_exercises WHERE routine_id IN (
    SELECT id FROM routines WHERE user_id = uid
  );

  DELETE FROM routines WHERE user_id = uid;

  -- User-created custom exercises only; shared seed rows (user_id IS NULL) stay.
  -- Must come after routine_exercises / session_exercises above (exercise_id FK is
  -- ON DELETE RESTRICT).
  DELETE FROM exercises WHERE user_id = uid;

  DELETE FROM routine_folders WHERE user_id = uid;
  DELETE FROM body_measurements WHERE user_id = uid;
  DELETE FROM progress_photos WHERE user_id = uid;

  -- Last: the auth row itself. Everything above is user-scoped (see note 4).
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Lock the function down: remove the default PUBLIC grant, allow only signed-in users.
REVOKE ALL ON FUNCTION delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

COMMIT;
