-- Create the delete_user_account RPC function
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the function owner's privileges
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  -- Delete user's data in dependency order
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

  DELETE FROM routine_folders WHERE user_id = uid;

  DELETE FROM body_measurements WHERE user_id = uid;

  DELETE FROM progress_photos WHERE user_id = uid;

  -- Delete auth user (must be last)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;
