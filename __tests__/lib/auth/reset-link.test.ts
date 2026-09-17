import { extractResetTokens } from '../../../lib/auth/reset-link';

/**
 * The password reset flow depends on reading the recovery tokens out of the
 * deep link the email sends. Supabase's implicit flow (the project's flow, see
 * `lib/supabase.ts`) puts them in the URL *fragment*, which expo-router drops
 * while routing — so this parser is the only thing standing between a valid
 * link and a screen that can never set the recovery session.
 */

const ACCESS = 'eyJhbGciOiJIUzI1NiJ9.access';
const REFRESH = 'rt_refresh_value';

describe('extractResetTokens', () => {
  it('reads a well-formed recovery fragment', () => {
    const url =
      `forja://reset-password#access_token=${ACCESS}` +
      `&expires_in=3600&refresh_token=${REFRESH}&token_type=bearer&type=recovery`;

    expect(extractResetTokens(url)).toEqual({
      accessToken: ACCESS,
      refreshToken: REFRESH,
    });
  });

  it('reads the same keys from a query string', () => {
    const url = `forja://reset-password?access_token=${ACCESS}&refresh_token=${REFRESH}`;

    expect(extractResetTokens(url)).toEqual({
      accessToken: ACCESS,
      refreshToken: REFRESH,
    });
  });

  it('decodes percent-encoded token values', () => {
    const encodedAccess = 'abc%2Bdef'; // abc+def
    const url = `forja://reset-password#access_token=${encodedAccess}&refresh_token=${REFRESH}`;

    expect(extractResetTokens(url)).toEqual({
      accessToken: 'abc+def',
      refreshToken: REFRESH,
    });
  });

  it('rejects a fragment that carries only one of the two tokens', () => {
    expect(
      extractResetTokens(`forja://reset-password#access_token=${ACCESS}&type=recovery`)
    ).toBeNull();
    expect(
      extractResetTokens(`forja://reset-password#refresh_token=${REFRESH}&type=recovery`)
    ).toBeNull();
  });

  it('rejects an empty token value', () => {
    expect(
      extractResetTokens(`forja://reset-password#access_token=&refresh_token=${REFRESH}`)
    ).toBeNull();
    expect(
      extractResetTokens(`forja://reset-password#access_token=${ACCESS}&refresh_token=`)
    ).toBeNull();
    expect(
      extractResetTokens(`forja://reset-password?access_token=&refresh_token=`)
    ).toBeNull();
  });

  it('treats the fragment as authoritative when it is present but incomplete', () => {
    // A half-written fragment is a broken link, not a cue to read the query.
    const url =
      `forja://reset-password?access_token=${ACCESS}&refresh_token=${REFRESH}` +
      `#access_token=${ACCESS}`;

    expect(extractResetTokens(url)).toBeNull();
  });

  it('rejects garbage input', () => {
    expect(extractResetTokens('not a url at all')).toBeNull();
    expect(extractResetTokens('forja://')).toBeNull();
    expect(extractResetTokens('forja://reset-password#')).toBeNull();
    expect(extractResetTokens('')).toBeNull();
    expect(extractResetTokens(null)).toBeNull();
    expect(extractResetTokens(undefined)).toBeNull();
  });

  it('rejects a link that carries no tokens at all', () => {
    expect(extractResetTokens('forja://reset-password#type=recovery')).toBeNull();
    expect(extractResetTokens('forja://reset-password')).toBeNull();
    expect(extractResetTokens('https://forja.app/reset-password?foo=bar')).toBeNull();
    expect(extractResetTokens('forja://reset-password?redirect_to=/(tabs)')).toBeNull();
  });

  it('falls back to the query when the fragment carries no token at all', () => {
    // "Authoritative" means the fragment decides *when it carries a token*. A
    // fragment with neither token is not a competing source, so the query
    // fallback still applies.
    const url =
      `forja://reset-password?access_token=${ACCESS}&refresh_token=${REFRESH}` +
      `#type=recovery`;

    expect(extractResetTokens(url)).toEqual({
      accessToken: ACCESS,
      refreshToken: REFRESH,
    });
  });

  it('keeps a malformed percent escape raw instead of throwing', () => {
    // decodeURIComponent throws on a lone '%'. The raw text is not a usable
    // token value, but it is still a non-empty one, so the pair comes back as
    // written rather than the whole link being rejected.
    const url = `forja://reset-password#access_token=abc%&refresh_token=${REFRESH}`;

    expect(extractResetTokens(url)).toEqual({
      accessToken: 'abc%',
      refreshToken: REFRESH,
    });
  });
});
