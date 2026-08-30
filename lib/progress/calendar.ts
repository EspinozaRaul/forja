const GRID_CELLS = 42;

/**
 * Build a 6-week (42 cell) month grid, Monday-first (ES convention). Cells
 * outside the month are null, inside they hold the day number. month is 1-based.
 */
export function buildMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  // (getDay() + 6) % 7 shifts Sunday-based weekday to Monday-first (Mon = 0).
  const leadingNulls = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const grid: (number | null)[] = [];
  for (let i = 0; i < leadingNulls; i++) grid.push(null);
  for (let day = 1; day <= daysInMonth; day++) grid.push(day);
  while (grid.length < GRID_CELLS) grid.push(null);
  return grid;
}

export function monthLabel(year: number, month: number, locale?: string): string {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale ?? 'es', { month: 'long', year: 'numeric' });
}

export function addMonths(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths - newYear * 12 + 1;
  return { year: newYear, month: newMonth };
}