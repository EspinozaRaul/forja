/**
 * Pure classification of Supabase auth errors into i18n keys.
 *
 * The returned value is always a catalogue key under one of the
 * `auth.<namespace>.error.*` groups (`login`, `signup`, `signOut`,
 * `deleteAccount`), never a user-facing string and never derived from
 * `error.message`. That message is environment-specific — on Android it can be
 * a Java exception such as
 * `fetch failed: java.net.ConnectException ...` carrying a raw IP and the
 * project hostname — and none of it belongs in front of the user.
 *
 * The invariant is about the *source* of the text, not about the word
 * "message": raw SDK text must never reach the user, while a value that comes
 * from our own structured field may be shown. `LocalizedAuthError` below is
 * that structured field — our own marker class, set by our own code, carrying
 * a catalogue key. An SDK error object never has this shape, so reading its
 * `i18nKey` is safe in a way that reading a raw `message` never is.
 *
 * Classification reads only the structured fields the SDK sets on its errors:
 * `name`, `status` and `code`. Anything unrecognised (null, undefined, a bare
 * string, a plain object with no auth fields) falls through to the generic key
 * instead of throwing.
 */

export type AuthErrorCategory =
  | 'network'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'rateLimited'
  | 'emailExists'
  | 'weakPassword'
  | 'generic';

/**
 * The operation whose failure produced the error.
 *
 * One namespace per operation, because the copy names the operation: a shared
 * namespace would force operation-neutral wording, and "we could not sign you
 * out" is the wrong message for a failed account deletion (and vice versa).
 * This mirrors the login/signup split, which exists for the same reason.
 */
export type AuthErrorNamespace = 'login' | 'signup' | 'signOut' | 'deleteAccount';

/**
 * Marker error for messages this app composes itself.
 *
 * `lib/hooks/useAuth.ts` returns these for the Google sign-in branches that
 * never reach the SDK (missing dev build, user cancelled, no OAuth URL). The
 * i18n key travels as a dedicated field instead of being smuggled through
 * `message`, so callers never have to sniff a string to decide whether it is a
 * catalogue key or raw SDK text.
 */
export class LocalizedAuthError extends Error {
  constructor(readonly i18nKey: string) {
    super(i18nKey);
    this.name = 'LocalizedAuthError';
  }
}

const RATE_LIMIT_CODES = ['over_email_send_rate_limit', 'over_request_rate_limit'];

const LOGIN_KEYS: Record<AuthErrorCategory, string> = {
  network: 'auth.login.error.network',
  invalidCredentials: 'auth.login.error.invalidCredentials',
  emailNotConfirmed: 'auth.login.error.emailNotConfirmed',
  rateLimited: 'auth.login.error.rateLimited',
  // Sign-in has no dedicated copy for these two: neither can be produced by a
  // sign-in attempt, so the generic sign-in message is the honest fallback.
  emailExists: 'auth.login.error.generic',
  weakPassword: 'auth.login.error.generic',
  generic: 'auth.login.error.generic',
};

const SIGNUP_KEYS: Record<AuthErrorCategory, string> = {
  network: 'auth.signup.error.network',
  emailExists: 'auth.signup.error.emailExists',
  weakPassword: 'auth.signup.error.weakPassword',
  rateLimited: 'auth.signup.error.rateLimited',
  // Neither can be produced by a sign-up attempt; fall back to the generic
  // sign-up message rather than borrow sign-in copy.
  invalidCredentials: 'auth.signup.error.generic',
  emailNotConfirmed: 'auth.signup.error.generic',
  generic: 'auth.signup.error.generic',
};

const SIGN_OUT_KEYS: Record<AuthErrorCategory, string> = {
  network: 'auth.signOut.error.network',
  rateLimited: 'auth.signOut.error.rateLimited',
  // A sign-out request cannot produce these: the user is already
  // authenticated, so credential, confirmation, availability and password
  // policy failures fall back to the sign-out generic message instead of
  // borrowing the auth screens' copy.
  invalidCredentials: 'auth.signOut.error.generic',
  emailNotConfirmed: 'auth.signOut.error.generic',
  emailExists: 'auth.signOut.error.generic',
  weakPassword: 'auth.signOut.error.generic',
  generic: 'auth.signOut.error.generic',
};

const DELETE_ACCOUNT_KEYS: Record<AuthErrorCategory, string> = {
  network: 'auth.deleteAccount.error.network',
  rateLimited: 'auth.deleteAccount.error.rateLimited',
  // Same reasoning as sign-out: account deletion runs against an already
  // authenticated account, so these cannot be produced and fall back to the
  // delete-account generic message.
  invalidCredentials: 'auth.deleteAccount.error.generic',
  emailNotConfirmed: 'auth.deleteAccount.error.generic',
  emailExists: 'auth.deleteAccount.error.generic',
  weakPassword: 'auth.deleteAccount.error.generic',
  generic: 'auth.deleteAccount.error.generic',
};

// One key table per namespace, selected exhaustively so a new namespace cannot
// silently fall through to another operation's copy.
const NAMESPACE_KEYS: Record<AuthErrorNamespace, Record<AuthErrorCategory, string>> = {
  login: LOGIN_KEYS,
  signup: SIGNUP_KEYS,
  signOut: SIGN_OUT_KEYS,
  deleteAccount: DELETE_ACCOUNT_KEYS,
};

function structuredError(
  error: unknown
): { name?: unknown; status?: unknown; code?: unknown } | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as { name?: unknown; status?: unknown; code?: unknown };
  return { name: e.name, status: e.status, code: e.code };
}

/**
 * The catalogue key carried by our own marker, or null when the value is not
 * one. Detected by the marker's `name` plus a string `i18nKey` — never by its
 * `message` — so an `instanceof` check is not required and the check also
 * survives a different JS realm. Nothing an SDK returns matches this shape.
 */
function localizedKey(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { name?: unknown; i18nKey?: unknown };
  if (candidate.name !== 'LocalizedAuthError') return null;
  if (typeof candidate.i18nKey !== 'string' || candidate.i18nKey.length === 0) return null;
  return candidate.i18nKey;
}

export function classifyAuthError(error: unknown): AuthErrorCategory {
  const fields = structuredError(error);
  if (!fields) return 'generic';

  const { name, status, code } = fields;

  // Network / offline. @supabase/auth-js defines isAuthRetryableFetchError as
  // `isAuthError(error) && error.name === 'AuthRetryableFetchError'`, and that
  // name is the SDK's own discriminator for "the request never left the
  // device". The package @supabase/supabase-js does NOT re-export that helper,
  // so we check the name/status locally instead of importing from a transitive
  // package.
  if (name === 'AuthRetryableFetchError' || status === 0) {
    return 'network';
  }

  // Structured codes win over the bare HTTP status: an `email_not_confirmed`
  // or `weak_password` response also carries status 400, so every code check
  // must stay ahead of the 400 fallback or it would swallow them.
  if (code === 'invalid_credentials') {
    return 'invalidCredentials';
  }

  if (code === 'email_not_confirmed') {
    return 'emailNotConfirmed';
  }

  if (code === 'user_already_exists' || code === 'email_exists') {
    return 'emailExists';
  }

  if (code === 'weak_password') {
    return 'weakPassword';
  }

  if (status === 429 || (typeof code === 'string' && RATE_LIMIT_CODES.includes(code))) {
    return 'rateLimited';
  }

  // Supabase answers a bad email/password pair with 400 and no usable code.
  if (status === 400) {
    return 'invalidCredentials';
  }

  return 'generic';
}

export function authErrorMessageKey(error: unknown, namespace: AuthErrorNamespace): string {
  const key = localizedKey(error);
  if (key) return key;

  return NAMESPACE_KEYS[namespace][classifyAuthError(error)];
}
