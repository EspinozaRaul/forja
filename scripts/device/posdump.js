#!/usr/bin/env node
/**
 * posdump — print every labelled node with its vertical position.
 *
 * This is how "did the screen scroll?" gets answered with a number instead of an opinion:
 * dump before a gesture, dump after it, and compare the `top` of the same text.
 *
 *   node scripts/device/posdump.js
 *   node scripts/device/posdump.js --grep Peso
 *   node scripts/device/posdump.js --json > before.json
 *
 * On a screen that never goes idle (the session screen re-renders a timer every second)
 * `uiautomator` refuses to dump. There the answer comes from a screenshot; see the README.
 */

const { dumpXml, parseNodes } = require('./lib/uidump');

const args = process.argv.slice(2);

/** @param {string} name */
function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

const grep = option('--grep');
const asJson = args.includes('--json');

const nodes = parseNodes(dumpXml())
  .filter((node) => !grep || node.text.includes(grep))
  .sort((a, b) => a.top - b.top || a.left - b.left);

if (asJson) {
  console.log(JSON.stringify(nodes, null, 2));
} else {
  for (const node of nodes) {
    const centre = Math.round((node.top + node.bottom) / 2);
    console.log(
      [
        String(node.top).padStart(5),
        String(node.bottom).padStart(5),
        `y=${String(centre).padStart(5)}`,
        node.clickable ? 'click' : '     ',
        node.text,
      ].join('  '),
    );
  }

  console.log(`\n${nodes.length} labelled node(s)${grep ? ` matching ${JSON.stringify(grep)}` : ''}`);
}
