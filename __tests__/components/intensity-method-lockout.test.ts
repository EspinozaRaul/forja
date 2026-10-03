import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards against the intensity-method lockout: a set that holds a method the UI does not
 * recognise loses the only control that could change it back.
 *
 * The defect, measured on the device on 2026-10-03: `SetLogger` gated its intensity button
 * behind `isLinear = method === 'linear' || method === null || method === 'partial'`, so a set
 * holding `'superset'` — a value the picker itself offers, and one that is persisted BEFORE
 * the pairing flow starts — fell into that branch with `isLinear` false, lost the button, and
 * had no way back. The picker offered no "linear" option either, so `handleSelectIntensityMethod`
 * had no branch that could clear a method.
 *
 * The properties pinned here are the two halves of the way out:
 *   1. the intensity control does not depend on the set's CURRENT method,
 *   2. the picker offers a way back to a plain set, and the handler acts on it.
 *
 * A static test can hold both: they are facts about the tree, not about rendering.
 */

const ROOT = path.join(__dirname, '..', '..');
const SET_LOGGER = path.join(ROOT, 'components', 'SetLogger.tsx');
const PICKER = path.join(ROOT, 'components', 'IntensityMethodPicker.tsx');
const ITEM = path.join(ROOT, 'components', 'session', 'SessionExerciseItem.tsx');

describe('intensity method is never a one-way door', () => {
  it('does not gate the intensity button behind the current method', () => {
    // The defect itself. Anything that makes the button's existence depend on `set.method`
    // reintroduces the lockout for every value that list forgets.
    const src = fs.readFileSync(SET_LOGGER, 'utf8');
    const marker = src.indexOf('accessibility.setLogger.intensityMethod');
    expect(marker).toBeGreaterThan(-1);
    const open = src.lastIndexOf('{', src.lastIndexOf('{', marker) - 1);
    const guard = src.slice(Math.max(0, open - 200), marker);
    expect(guard).not.toMatch(/isLinear/);
    expect(guard).not.toMatch(/set\.method/);
  });

  it('offers linear in the picker, and first', () => {
    // "Lineal" is the default state and the only explicit way out of every other method.
    const src = fs.readFileSync(PICKER, 'utf8');
    expect(src).toMatch(/export type IntensityMethod = 'linear'/);
    const table = src.slice(src.indexOf('const INTENSITY_METHODS'));
    const entries = [...table.matchAll(/\{ id: '([a-z_]+)'/g)].map((m) => m[1]);
    expect(entries[0]).toBe('linear');
    expect(entries).toContain('superset');
  });

  it('clears every trace of a method when linear is chosen', () => {
    // Returning to linear is not just writing the method: a drop group keeps `isDropGroup`,
    // and a partial keeps `partialReps`. Leaving either behind means the row still renders as
    // something that is not a plain set.
    const src = fs.readFileSync(ITEM, 'utf8');
    const branch = src.indexOf("if (method === 'linear')");
    expect(branch).toBeGreaterThan(-1);
    const body = src.slice(branch, src.indexOf('\n    }', branch));
    expect(body).toContain("method: 'linear'");
    expect(body).toContain('isDropGroup: false');
    expect(body).toContain('partialReps: null');
  });

  it('has both catalogue entries for the new option', () => {
    for (const lang of ['es', 'en']) {
      const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'i18n', `${lang}.json`), 'utf8'));
      expect(typeof catalog.methods.linear.label).toBe('string');
      expect(typeof catalog.methods.linear.description).toBe('string');
    }
  });
});
