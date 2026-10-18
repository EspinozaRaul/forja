/**
 * The device scripts read the screen through `uiautomator dump`, and `posdump` answers
 * "did it scroll?" by comparing the parsed `top` of the same label between two dumps.
 * If the parser is wrong the measurement is wrong, and a wrong measurement is how a
 * regression gets reported as fixed. So the parser is pinned here, without a phone.
 */

const { parseNodes } = require('../../scripts/device/lib/uidump');

/** Wraps nodes in the minimal document `uiautomator` emits. */
const document = (body) => `<hierarchy rotation="0">${body}</hierarchy>`;

describe('parseNodes', () => {
  it('reads the label and the bounds of a node', () => {
    const nodes = parseNodes(
      document(
        '<node index="0" text="Peso muerto rumano" class="android.widget.TextView" ' +
          'clickable="false" bounds="[201,989][1018,1080]" />',
      ),
    );

    expect(nodes).toEqual([
      {
        text: 'Peso muerto rumano',
        className: 'android.widget.TextView',
        clickable: false,
        scrollable: false,
        left: 201,
        top: 989,
        right: 1018,
        bottom: 1080,
      },
    ]);
  });

  it('falls back to content-desc when the node has no text', () => {
    const nodes = parseNodes(
      document('<node content-desc="Eliminar" bounds="[0,0][10,10]" />'),
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].text).toBe('Eliminar');
  });

  it('drops nodes that carry no label at all', () => {
    const nodes = parseNodes(
      document(
        '<node class="android.view.ViewGroup" bounds="[0,0][10,10]" />' +
          '<node text="   " bounds="[0,0][10,10]" />' +
          '<node text="Cancelar" bounds="[0,20][10,30]" />',
      ),
    );

    expect(nodes.map((node) => node.text)).toEqual(['Cancelar']);
  });

  it('keeps document order, which is what makes two dumps comparable', () => {
    const nodes = parseNodes(
      document(
        '<node text="primero" bounds="[0,900][10,910]" />' +
          '<node text="segundo" bounds="[0,100][10,110]" />',
      ),
    );

    expect(nodes.map((node) => node.text)).toEqual(['primero', 'segundo']);
  });

  it('reports unreadable bounds as -1 instead of a plausible number', () => {
    const nodes = parseNodes(document('<node text="sin bounds" />'));

    expect(nodes).toEqual([
      {
        text: 'sin bounds',
        className: '',
        clickable: false,
        scrollable: false,
        left: -1,
        top: -1,
        right: -1,
        bottom: -1,
      },
    ]);
  });

  it('flags the node that owns the scroll, which is the viewport a gesture is measured against', () => {
    const nodes = parseNodes(
      document(
        '<node class="android.view.ViewGroup" bounds="[0,530][1220,1557]" scrollable="true" />',
      ),
      { includeUnlabelled: true },
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0].scrollable).toBe(true);
    expect(nodes[0].bottom).toBe(1557);
  });

  it('drops unlabelled containers by default, because listing the whole tree is noise', () => {
    const xml = document('<node class="android.view.ViewGroup" bounds="[0,530][1220,1557]" />');

    expect(parseNodes(xml)).toHaveLength(0);
    expect(parseNodes(xml, { includeUnlabelled: true })).toHaveLength(1);
  });

  it('marks only the clickable nodes as clickable', () => {
    const nodes = parseNodes(
      document(
        '<node text="botón" clickable="true" bounds="[0,0][10,10]" />' +
          '<node text="etiqueta" clickable="false" bounds="[0,0][10,10]" />',
      ),
    );

    expect(nodes.map((node) => node.clickable)).toEqual([true, false]);
  });

  it('reads every node in a realistic dump, not just the first', () => {
    const nodes = parseNodes(
      document(
        '<node index="0" text="Elevación lateral" bounds="[201,989][1018,1050]" />' +
          '<node index="1" text="Peso muerto rumano" bounds="[201,1060][1018,1121]" />' +
          '<node index="2" text="Remo en Barra T" bounds="[201,1131][1018,1192]" />',
      ),
    );

    expect(nodes).toHaveLength(3);
    expect(nodes.at(-1).top).toBe(1131);
  });
});
