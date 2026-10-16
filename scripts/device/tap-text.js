#!/usr/bin/env node
/**
 * tap-text — tap the centre of the node whose label is an exact match.
 *
 *   node scripts/device/tap-text.js "Finalizar sesión"
 *   node scripts/device/tap-text.js "Eliminar" --index 1
 *
 * Tapping by text and not by coordinates keeps a script readable across screens and
 * survives the layout moving.
 *
 * MIUI/HyperOS refuses the inject: `SecurityException: Injecting input events requires the
 * caller to have the INJECT_EVENTS permission`. Enabling Developer options → "USB debugging
 * (Security settings)" is what lifts it. This script detects that exact failure and says so.
 */

const { adb, dumpXml, parseNodes } = require('./lib/uidump');

const args = process.argv.slice(2);
const wanted = args.find((arg) => !arg.startsWith('--'));

if (!wanted) {
  console.error('usage: node scripts/device/tap-text.js "<exact label>" [--index N]');
  process.exit(2);
}

const indexOption = args.indexOf('--index');
const index = indexOption === -1 ? 0 : Number(args[indexOption + 1]);

const matches = parseNodes(dumpXml())
  .filter((node) => node.text === wanted)
  .sort((a, b) => a.top - b.top || a.left - b.left);

if (matches.length === 0) {
  const near = parseNodes(dumpXml())
    .filter((node) => node.text.includes(wanted))
    .map((node) => `  ${node.top}  ${node.text}`)
    .join('\n');

  console.error(`no node labelled exactly ${JSON.stringify(wanted)}`);
  if (near) console.error(`\ncontaining it:\n${near}`);
  process.exit(1);
}

const target = matches[index];
if (!target) {
  console.error(`${matches.length} match(es) for ${JSON.stringify(wanted)}; no index ${index}`);
  process.exit(1);
}

const x = Math.round((target.left + target.right) / 2);
const y = Math.round((target.top + target.bottom) / 2);

const result = adb(['shell', 'input', 'tap', String(x), String(y)], {
  allowFailure: true,
  stderrToStdout: true,
});

if (/INJECT_EVENTS|SecurityException/i.test(result)) {
  console.error(
    'the device refused the injected tap.\n' +
      'Enable Developer options → "USB debugging (Security settings)" — without it MIUI/HyperOS\n' +
      'blocks `input` entirely, while `screencap` and `uiautomator dump` keep working.',
  );
  process.exit(1);
}

console.log(`tapped ${JSON.stringify(wanted)} at ${x},${y}`);
