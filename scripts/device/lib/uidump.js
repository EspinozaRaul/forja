/**
 * Shared plumbing for the device scripts: run adb, dump the UI hierarchy, parse it.
 *
 * Why this lives in the repo and not in /tmp: these helpers were lost to a reboot once
 * already, and with them the only screenshot-backed evidence of a bug. A device script
 * that cannot survive a restart is not evidence.
 *
 * `parseNodes` is deliberately pure and synchronous so it can be tested without a phone.
 * The adb calls are kept apart from it for the same reason.
 */

const { execFileSync } = require('node:child_process');

/** Where the dump is written on the device. Overwritten on every call. */
const REMOTE_DUMP_PATH = '/sdcard/forja-window-dump.xml';

/**
 * Runs one adb command and returns its stdout.
 *
 * @param {string[]} args
 * @param {{ allowFailure?: boolean, stderrToStdout?: boolean }} [options]
 * @returns {string}
 */
function adb(args, options = {}) {
  const { allowFailure = false, stderrToStdout = false } = options;

  try {
    return execFileSync('adb', args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: stderrToStdout ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    if (allowFailure) return '';
    throw error;
  }
}

/**
 * Dumps the current screen's accessibility tree and returns the raw XML.
 *
 * Fails with an actionable message when `uiautomator` cannot reach an idle state, which is
 * what happens on any screen that never stops rendering — the session screen updates a timer
 * every second. On those screens `screencap` is the only ground truth; see the README.
 *
 * @returns {string}
 */
function dumpXml() {
  const result = adb(['shell', 'uiautomator', 'dump', REMOTE_DUMP_PATH], {
    allowFailure: true,
    stderrToStdout: true,
  });

  if (/could not get idle state/i.test(result)) {
    throw new Error(
      'uiautomator could not get an idle state: this screen never stops rendering.\n' +
        'Use `adb exec-out screencap -p > /tmp/screen.png` instead — see scripts/device/README.md.',
    );
  }

  const xml = adb(['shell', 'cat', REMOTE_DUMP_PATH]);
  if (!xml.includes('<hierarchy')) {
    throw new Error(`no UI hierarchy at ${REMOTE_DUMP_PATH} — is a device attached? \`adb devices\``);
  }

  return xml;
}

/**
 * @typedef {object} UiNode
 * @property {string} text        The node's `text`, or its `content-desc` when the text is empty.
 * @property {string} className
 * @property {boolean} clickable
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * Parses a `uiautomator dump` XML document into the non-empty nodes, in document order.
 *
 * Document order is kept rather than sorted: it is the native tree's own order and the one
 * that stays stable between two dumps of the same screen, which is what makes a `top`
 * comparison meaningful when asking "did this scroll".
 *
 * @param {string} xml
 * @returns {UiNode[]}
 */
function parseNodes(xml) {
  /** @type {UiNode[]} */
  const nodes = [];
  const nodePattern = /<node\b[^>]*?\/?>/g;

  for (const [tag] of xml.matchAll(nodePattern)) {
    const attributes = new Map();
    for (const [, name, value] of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
      attributes.set(name, value);
    }

    const attribute = (name) => attributes.get(name) ?? '';

    const text = (attribute('text') || attribute('content-desc')).trim();
    if (!text) continue;

    const bounds = attribute('bounds').match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);

    nodes.push({
      text,
      className: attribute('class'),
      clickable: attribute('clickable') === 'true',
      left: bounds ? Number(bounds[1]) : -1,
      top: bounds ? Number(bounds[2]) : -1,
      right: bounds ? Number(bounds[3]) : -1,
      bottom: bounds ? Number(bounds[4]) : -1,
    });
  }

  return nodes;
}

module.exports = { adb, dumpXml, parseNodes, REMOTE_DUMP_PATH };
