import {
  planSupersetRows,
  type SupersetMember,
  type SupersetRenderRow,
} from '../../../lib/utils/superset-grouping';

interface Row extends SupersetMember {
  order: number;
}

function row(id: number, order: number, pairId: number | null = null): Row {
  return { id, order, supersetPairId: pairId };
}

const ids = (rows: SupersetRenderRow<Row>[]) =>
  rows.map((r) => (r.kind === 'pair' ? `pair:${r.pairId}` : `row:${r.exercise.id}`));

describe('planSupersetRows', () => {
  it('returns no rows for an empty list', () => {
    expect(planSupersetRows([])).toEqual({ rows: [], unrenderablePairIds: [] });
  });

  it('renders every unpaired exercise standalone, in order', () => {
    const plan = planSupersetRows([row(1, 1), row(2, 2), row(3, 3)]);
    expect(ids(plan.rows)).toEqual(['row:1', 'row:2', 'row:3']);
    expect(plan.unrenderablePairIds).toEqual([]);
  });

  it('collapses exactly two members sharing a pair id into one pair row', () => {
    const plan = planSupersetRows([row(1, 1, 555), row(2, 2, 555)]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]).toMatchObject({ kind: 'pair', pairId: 555 });
    if (plan.rows[0].kind === 'pair') {
      expect(plan.rows[0].members.map((m) => m.id)).toEqual([1, 2]);
    }
    expect(plan.unrenderablePairIds).toEqual([]);
  });

  it('reports a one-member orphan as unrenderable and renders it standalone', () => {
    const plan = planSupersetRows([row(1, 1, 555)]);
    expect(ids(plan.rows)).toEqual(['row:1']);
    expect(plan.unrenderablePairIds).toEqual([555]);
  });

  it('reports a three-member group as unrenderable and renders every member standalone', () => {
    const plan = planSupersetRows([row(1, 1, 555), row(2, 2, 555), row(3, 3, 555)]);
    expect(ids(plan.rows)).toEqual(['row:1', 'row:2', 'row:3']);
    expect(plan.unrenderablePairIds).toEqual([555]);
  });

  it('classifies a mixed list without disturbing the input order', () => {
    const plan = planSupersetRows([
      row(1, 1, 555),
      row(2, 2, 555),
      row(3, 3),
      row(4, 4, 777),
      row(5, 5, 999),
      row(6, 6, 999),
      row(7, 7, 999),
    ]);
    expect(ids(plan.rows)).toEqual([
      'pair:555',
      'row:3',
      'row:4',
      'row:5',
      'row:6',
      'row:7',
    ]);
    expect(plan.unrenderablePairIds).toEqual([777, 999]);
  });

  it('renders a valid pair once, at the position of its first member', () => {
    const plan = planSupersetRows([row(1, 1, 555), row(2, 2), row(3, 3, 555)]);
    expect(ids(plan.rows)).toEqual(['pair:555', 'row:2']);
    expect(plan.unrenderablePairIds).toEqual([]);
  });

  it('never reports an unpaired row as an unrenderable pair', () => {
    const plan = planSupersetRows([row(1, 1), row(2, 2), row(3, 3)]);
    expect(plan.unrenderablePairIds).toEqual([]);
  });
});
