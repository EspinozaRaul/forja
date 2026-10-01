import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards the version footer in `app/settings.tsx`.
 *
 * It exists because the owner could not answer "which build is on my phone?": four
 * published releases all report `versionName 1.0.8` — codes 12, 13, 14 and 15 — and
 * Android's app-info screen shows only the name. Every diagnostic conversation
 * started with a guess.
 *
 * The property that makes the footer useful is the SOURCE of the number. Read from
 * the installed package, it is the identity of the binary. Read from a literal, from
 * `app.json`, or from the embedded manifest, it can be a number that no phone is
 * running — which is exactly the failure this guards against. The assertions are
 * structural against the source for the same reason as
 * `__tests__/components/routine-start-modal.test.ts`: the screen is not extractable.
 */

const ROOT = path.join(__dirname, '..', '..');
const SCREEN = path.join(ROOT, 'app', 'settings.tsx');
const ES = path.join(ROOT, 'lib', 'i18n', 'es.json');
const EN = path.join(ROOT, 'lib', 'i18n', 'en.json');

/** Returns the source of the JSX element that renders the build version. */
function versionFooterBlock(src: string): string {
  const marker = src.indexOf("t('settings.buildVersion'");
  if (marker === -1) return '';
  const open = src.lastIndexOf('<Text', marker);
  const close = src.indexOf('</Text>', marker);
  if (open === -1 || close === -1) return '';
  return src.slice(open, close);
}

describe('settings version footer', () => {
  const src = fs.readFileSync(SCREEN, 'utf8');

  it('reads the version from the installed package, not from a literal', () => {
    // The negative control for this assertion is the defect itself: a hardcoded
    // '1.0.8' would pass every other test in this file and be useless on a phone.
    expect(src).toMatch(/from 'expo-application'/);
    expect(versionFooterBlock(src)).toContain('nativeApplicationVersion');
    expect(versionFooterBlock(src)).toContain('nativeBuildVersion');
  });

  it('does not read the version from the bundle manifest', () => {
    // `expo-constants`'s expoConfig resolves from the embedded manifest, which a dev
    // build can disagree with, and it is currently imported by nothing. Naming it
    // here keeps a future "simplification" from quietly rerouting the source.
    const footer = versionFooterBlock(src);
    expect(footer).not.toContain('Constants.');
    expect(footer).not.toContain("from 'expo-constants'");
  });

  it('renders the footer through i18n', () => {
    expect(src).toContain("t('settings.buildVersion'");
  });

  it('has the string in both catalogues with both placeholders', () => {
    const es = JSON.parse(fs.readFileSync(ES, 'utf8')).settings.buildVersion;
    const en = JSON.parse(fs.readFileSync(EN, 'utf8')).settings.buildVersion;

    expect(typeof es).toBe('string');
    expect(typeof en).toBe('string');
    for (const text of [es, en]) {
      expect(text).toContain('{{version}}');
      expect(text).toContain('{{build}}');
    }
  });
});
