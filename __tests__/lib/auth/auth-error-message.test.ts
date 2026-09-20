import {
  authErrorMessageKey,
  classifyAuthError,
  LocalizedAuthError,
} from '../../../lib/auth/auth-error-message';
import type { AuthErrorCategory } from '../../../lib/auth/auth-error-message';
import es from '../../../lib/i18n/es.json';
import en from '../../../lib/i18n/en.json';

// Mirrors the real AuthRetryableFetchError the SDK throws when the request
// never reaches Supabase: the name is the discriminator, status is 0, and the
// message is the environment-specific text the user must never see.
const RAW_NETWORK_MESSAGE =
  'fetch failed: java.net.ConnectException: Failed to connect to tvhirldahraymahvthfq.supabase.co/172.64.149.246:443';

function networkError() {
  return Object.assign(new Error(RAW_NETWORK_MESSAGE), {
    name: 'AuthRetryableFetchError',
    status: 0,
  });
}

const ALL_CATEGORIES: AuthErrorCategory[] = [
  'network',
  'invalidCredentials',
  'emailNotConfirmed',
  'rateLimited',
  'emailExists',
  'weakPassword',
  'generic',
];

// One representative input per category, so the mapping tests exercise every
// branch instead of a single one.
const CATEGORY_INPUTS: Record<AuthErrorCategory, unknown> = {
  network: { status: 0 },
  invalidCredentials: { status: 400 },
  emailNotConfirmed: { status: 400, code: 'email_not_confirmed' },
  rateLimited: { status: 429 },
  emailExists: { code: 'user_already_exists' },
  weakPassword: { code: 'weak_password' },
  generic: null,
};

describe('classifyAuthError', () => {
  it('classifies AuthRetryableFetchError as network', () => {
    expect(classifyAuthError(networkError())).toBe('network');
  });

  it('classifies a zero status as network', () => {
    expect(classifyAuthError({ status: 0 })).toBe('network');
  });

  it('classifies the invalid_credentials code as invalid credentials', () => {
    expect(classifyAuthError({ status: 400, code: 'invalid_credentials' })).toBe(
      'invalidCredentials'
    );
  });

  it('classifies a bare 400 as invalid credentials', () => {
    expect(classifyAuthError({ status: 400 })).toBe('invalidCredentials');
  });

  it('classifies email_not_confirmed as its own category even when status is 400', () => {
    // Real Supabase responses carry status 400 for this code; the structured
    // code must win over the 400 fallback.
    expect(classifyAuthError({ status: 400, code: 'email_not_confirmed' })).toBe(
      'emailNotConfirmed'
    );
  });

  it('classifies user_already_exists as email exists even when status is 400', () => {
    expect(classifyAuthError({ status: 400, code: 'user_already_exists' })).toBe('emailExists');
  });

  it('classifies email_exists as email exists', () => {
    expect(classifyAuthError({ status: 422, code: 'email_exists' })).toBe('emailExists');
  });

  it('classifies weak_password as weak password even when status is 400', () => {
    expect(classifyAuthError({ status: 400, code: 'weak_password' })).toBe('weakPassword');
  });

  it('classifies a 429 as rate limited', () => {
    expect(classifyAuthError({ status: 429 })).toBe('rateLimited');
  });

  it('classifies over_email_send_rate_limit as rate limited', () => {
    expect(classifyAuthError({ status: 429, code: 'over_email_send_rate_limit' })).toBe(
      'rateLimited'
    );
  });

  it('classifies over_request_rate_limit as rate limited', () => {
    expect(classifyAuthError({ status: 429, code: 'over_request_rate_limit' })).toBe(
      'rateLimited'
    );
  });

  it('classifies a rate-limit code as rate limited even without status 429', () => {
    expect(classifyAuthError({ code: 'over_request_rate_limit' })).toBe('rateLimited');
  });

  it('classifies an unrecognised structured error as generic', () => {
    expect(classifyAuthError({ name: 'AuthApiError', status: 500, code: 'unexpected' })).toBe(
      'generic'
    );
  });

  it('classifies null as generic', () => {
    expect(classifyAuthError(null)).toBe('generic');
  });

  it('classifies undefined as generic', () => {
    expect(classifyAuthError(undefined)).toBe('generic');
  });

  it('classifies a bare string as generic', () => {
    expect(classifyAuthError(RAW_NETWORK_MESSAGE)).toBe('generic');
  });

  it('classifies a plain object without auth fields as generic', () => {
    expect(classifyAuthError({ some: 'thing' })).toBe('generic');
  });

  it('classifies the app-owned marker as generic', () => {
    // The marker is not an SDK error; its key is resolved by
    // authErrorMessageKey, not by the category table.
    expect(classifyAuthError(new LocalizedAuthError('auth.errors.loginCancelled'))).toBe(
      'generic'
    );
  });

  it('never throws on a value with throwing getters for the message', () => {
    // classifyAuthError must not touch `message` at all, so a hostile getter
    // cannot make it throw.
    const hostile = {
      get message(): string {
        throw new Error('message was read');
      },
      name: 'AuthRetryableFetchError',
    };
    expect(classifyAuthError(hostile)).toBe('network');
  });
});

describe('authErrorMessageKey', () => {
  it('returns the marker i18n key for the login namespace', () => {
    expect(authErrorMessageKey(new LocalizedAuthError('auth.errors.loginCancelled'), 'login')).toBe(
      'auth.errors.loginCancelled'
    );
  });

  it('returns the marker i18n key for the signup namespace', () => {
    expect(
      authErrorMessageKey(new LocalizedAuthError('auth.errors.googleRequiresDevBuild'), 'signup')
    ).toBe('auth.errors.googleRequiresDevBuild');
  });

  it('returns the marker i18n key for a structural clone of the marker', () => {
    // Detection is by name plus a string i18nKey, so it survives a different
    // realm and does not depend on instanceof.
    const clone = { name: 'LocalizedAuthError', i18nKey: 'auth.errors.noOAuthUrl' };
    expect(authErrorMessageKey(clone, 'login')).toBe('auth.errors.noOAuthUrl');
  });

  it('ignores a marker-shaped value whose i18nKey is not a string', () => {
    expect(authErrorMessageKey({ name: 'LocalizedAuthError', i18nKey: 42 }, 'login')).toBe(
      'auth.login.error.generic'
    );
  });

  it('maps every category to a login key', () => {
    for (const category of ALL_CATEGORIES) {
      const key = authErrorMessageKey(CATEGORY_INPUTS[category], 'login');
      expect({ category, key }).toEqual({
        category,
        key: expect.stringMatching(/^auth\.login\.error\./),
      });
    }
  });

  it('maps every category to a signup key', () => {
    for (const category of ALL_CATEGORIES) {
      const key = authErrorMessageKey(CATEGORY_INPUTS[category], 'signup');
      expect({ category, key }).toEqual({
        category,
        key: expect.stringMatching(/^auth\.signup\.error\./),
      });
    }
  });

  it('gives the signup categories their own copy', () => {
    expect(authErrorMessageKey({ status: 0 }, 'signup')).toBe('auth.signup.error.network');
    expect(authErrorMessageKey({ code: 'user_already_exists' }, 'signup')).toBe(
      'auth.signup.error.emailExists'
    );
    expect(authErrorMessageKey({ code: 'weak_password' }, 'signup')).toBe(
      'auth.signup.error.weakPassword'
    );
    expect(authErrorMessageKey({ status: 429 }, 'signup')).toBe('auth.signup.error.rateLimited');
  });

  it('resolves every mapped key in both catalogues as a string', () => {
    // A typo in the key tables would otherwise only show up on a device, in
    // one language, as a literal `auth.signup.error.network` on screen.
    const resolve = (catalog: unknown, key: string): unknown =>
      key.split('.').reduce<unknown>((node, part) => {
        if (typeof node !== 'object' || node === null) return undefined;
        return (node as Record<string, unknown>)[part];
      }, catalog);

    const problems: string[] = [];
    for (const namespace of ['login', 'signup'] as const) {
      for (const category of ALL_CATEGORIES) {
        const key = authErrorMessageKey(CATEGORY_INPUTS[category], namespace);
        for (const [label, catalog] of [
          ['es', es],
          ['en', en],
        ] as const) {
          if (typeof resolve(catalog, key) !== 'string') {
            problems.push(`${label}: ${namespace}/${category} -> ${key} is not a string`);
          }
        }
      }
    }

    expect(problems).toEqual([]);
  });
});

describe('raw SDK text never reaches the user', () => {
  // The negative control: this is the exact real-world leak. Whatever the
  // module returns, it must be a catalogue key — never the raw message.
  it('never derives its output from the raw error message', () => {
    const result = classifyAuthError(networkError());

    expect(result).toBe('network');
    expect(result).not.toBe(RAW_NETWORK_MESSAGE);
    expect(result).not.toContain('java');
    expect(result).not.toContain('ConnectException');
    expect(result).not.toContain('supabase.co');
    expect(result).not.toContain('172.64');
    expect(result).not.toContain('fetch failed');
    expect(result).not.toContain('message');
  });

  it.each(['login', 'signup'] as const)(
    'maps the network leak to a catalogue key in the %s namespace',
    (namespace) => {
      const key = authErrorMessageKey(networkError(), namespace);

      expect(key).toBe(`auth.${namespace}.error.network`);
      expect(key).not.toBe(RAW_NETWORK_MESSAGE);
      expect(key).not.toContain('java');
      expect(key).not.toContain('ConnectException');
      expect(key).not.toContain('supabase.co');
      expect(key).not.toContain('172.64');
      expect(key).not.toContain('fetch failed');
      expect(key).not.toContain('message');
    }
  );

  it('never echoes a raw message carried by a marker-shaped object', () => {
    const key = authErrorMessageKey(
      Object.assign(new Error(RAW_NETWORK_MESSAGE), { name: 'AuthApiError', status: 500 }),
      'signup'
    );

    expect(key).toBe('auth.signup.error.generic');
    expect(key).not.toContain('java');
    expect(key).not.toContain('ConnectException');
    expect(key).not.toContain('supabase.co');
    expect(key).not.toContain('172.64');
  });
});
