/**
 * Shared plumbing for the device scripts: run adb, dump the UI hierarchy, parse it.
 *
 * Why this lives in the repo and not in /tmp: these helpers were lost to a reboot once
 * already, and with them the only screenshot-backed evidence of a bug. A device script
 * that cannot survive a restart is not evidence.
 *
 * `parseNodes` is deliberately pure and synchronous so it can be tested without a phone.
 * The adb calls are kept apart from it for the same reason.
 *
 * Every adb call goes through `spawnSync`, not `execFileSync`: `uiautomator` reports its
 * failures on stderr while still exiting 0, so anything that only reads stdout silently
 * loses the reason. That is not hypothetical — it is how the first version of this file
 * turned "could not get idle state" into a stack trace from `cat`.
 */

const { spawnSync } = require('node:child_process');

/** Where the dump is written on the device. Overwritten on every call. */
const REMOTE_DUMP_PATH = '/sdcard/forja-window-dump.xml';

/**
 * @typedef {object} AdbResult
 * @property {boolean} ok      The process exited 0.
 * @property {string} stdout
 * @property {string} stderr
 * @property {string} text     stdout and stderr together, for matching either stream.
 */

/**
 * Runs one adb command.
 *
 * @param {string[]} args
 * @returns {AdbResult}
 */
function adb(args) {
  const result = spawnSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (result.error) {
    throw new Error(
      `could not run adb: ${result.error.message}\nIs adb installed and is a device attached?`,
    );
  }

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  return { ok: result.status === 0, stdout, stderr, text: `${stdout}${stderr}` };
}

/** The failure that made this file exist: a screen that never goes idle. */
function isIdleStateFailure(text) {
  return /could not get idle state/i.test(text);
}

/** How to read a screen that cannot be dumped. */
const IDLE_STATE_HINT =
  'uiautomator could not get an idle state: this screen never stops rendering.\n' +
  'Use `adb exec-out screencap -p > /tmp/screen.png` instead, or pause whatever keeps\n' +
  'redrawing it (on the session screen, "Pausar" stops the timer). See scripts/device/README.md.';

/**
 * Dumps the current screen's accessibility tree and returns the raw XML.
 *
 * @returns {string}
 */
function dumpXml() {
  const dump = adb(['shell', 'uiautomator', 'dump', REMOTE_DUMP_PATH]);

  if (isIdleStateFailure(dump.text)) {
    throw new Error(IDLE_STATE_HINT);
  }

  if (!dump.ok) {
    throw new Error(`uiautomator dump failed: ${dump.text.trim() || 'no output'}`);
  }

  const dumpFile = adb(['shell', 'cat', REMOTE_DUMP_PATH]);
  if (!dumpFile.stdout.includes('<hierarchy')) {
    throw new Error(
      `no UI hierarchy at ${REMOTE_DUMP_PATH} — is a device attached? Check \`adb devices\`.`,
    );
  }

  return dumpFile.stdout;
}

/**
 * Taps a point in physical pixels, translating the one failure worth explaining.
 *
 * @param {number} x
 * @param {number} y
 */
function tap(x, y) {
  const result = adb(['shell', 'input', 'tap', String(x), String(y)]);

  if (/INJECT_EVENTS|SecurityException/i.test(result.text)) {
    throw new Error(
      'the device refused the injected tap.\n' +
        'Enable Developer options → "USB debugging (Security settings)" — without it MIUI/HyperOS\n' +
        'blocks `input` entirely, while `screencap` and `uiautomator dump` keep working.',
    );
  }

  if (!result.ok) {
    throw new Error(`tap at ${x},${y} failed: ${result.text.trim() || 'no output'}`);
  }
}

/**
 * @typedef {object} UiNode
 * @property {string} text        The node's `text`, or its `content-desc` when the text is empty.
 * @property {string} className
 * @property {boolean} clickable
 * @property {boolean} scrollable
 * @property {number} left
 * @property {number} top
 * @property {number} right
 * @property {number} bottom
 */

/**
 * Parses a `uiautomator dump` XML document into nodes, in document order.
 *
 * Document order is kept rather than sorted: it is the native tree's own order and the one
 * that stays stable between two dumps of the same screen, which is what makes a `top`
 * comparison meaningful when asking "did this scroll".
 *
 * @param {string} xml
 * @param {{ includeUnlabelled?: boolean }} [options] `includeUnlabelled` keeps containers
 *   such as the scrolling `View`/`ScrollView`, whose bounds are the viewport.
 * @returns {UiNode[]}
 */
function parseNodes(xml, options = {}) {
  const { includeUnlabelled = false } = options;
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
    if (!text && !includeUnlabelled) continue;

    const bounds = attribute('bounds').match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);

    nodes.push({
      text,
      className: attribute('class'),
      clickable: attribute('clickable') === 'true',
      scrollable: attribute('scrollable') === 'true',
      left: bounds ? Number(bounds[1]) : -1,
      top: bounds ? Number(bounds[2]) : -1,
      right: bounds ? Number(bounds[3]) : -1,
      bottom: bounds ? Number(bounds[4]) : -1,
    });
  }

  return nodes;
}

module.exports = {
  adb,
  dumpXml,
  isIdleStateFailure,
  parseNodes,
  tap,
  IDLE_STATE_HINT,
  REMOTE_DUMP_PATH,
};
