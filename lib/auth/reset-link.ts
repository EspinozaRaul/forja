/**
 * Parsing for the emailed password-recovery deep link.
 *
 * The project uses Supabase's implicit flow (`detectSessionInUrl: false`, no
 * explicit `flowType` in `lib/supabase.ts`), so the recovery email sends the
 * user back to `forja://reset-password#access_token=…&refresh_token=…&type=recovery`.
 * The tokens live in the URL *fragment*, and expo-router drops the fragment
 * while resolving the route — so the raw URL has to be parsed here.
 *
 * Deliberately pure: no React Native, expo or supabase imports, so the parsing
 * rules can be unit-tested directly and the screen stays the only stateful part
 * of the flow.
 */

export interface ResetTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_PARAM = 'access_token';
const REFRESH_TOKEN_PARAM = 'refresh_token';

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape sequence cannot be a usable token value, so keep the
    // raw text and let the pair validation reject it if it is empty.
    return value;
  }
}

function parseParams(raw: string): Map<string, string> {
  const params = new Map<string, string>();
  if (!raw) return params;

  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const separator = pair.indexOf('=');
    const key = separator === -1 ? pair : pair.slice(0, separator);
    const value = separator === -1 ? '' : pair.slice(separator + 1);
    params.set(decode(key), decode(value));
  }

  return params;
}

/** Requires BOTH tokens, and requires each of them to carry a value. */
function readPair(params: Map<string, string>): ResetTokens | null {
  const accessToken = params.get(ACCESS_TOKEN_PARAM)?.trim();
  const refreshToken = params.get(REFRESH_TOKEN_PARAM)?.trim();

  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/**
 * Extracts the recovery token pair from a full deep-link URL.
 *
 * The fragment is the authoritative source: when it carries either token, the
 * link is judged by the fragment alone, so a half-written fragment is a broken
 * link instead of a cue to read the query string. The query string is accepted
 * as a fallback because both shapes reach the app in practice.
 *
 * Returns `null` for anything that does not carry a complete, non-empty pair —
 * including garbage input, links with one token, and links with none.
 */
export function extractResetTokens(url: string | null | undefined): ResetTokens | null {
  if (!url) return null;

  const hashIndex = url.indexOf('#');
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const beforeFragment = hashIndex === -1 ? url : url.slice(0, hashIndex);

  const fragmentParams = parseParams(fragment);
  if (fragmentParams.has(ACCESS_TOKEN_PARAM) || fragmentParams.has(REFRESH_TOKEN_PARAM)) {
    return readPair(fragmentParams);
  }

  const queryIndex = beforeFragment.indexOf('?');
  if (queryIndex === -1) return null;

  return readPair(parseParams(beforeFragment.slice(queryIndex + 1)));
}
