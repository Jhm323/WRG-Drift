// ISO week (Mon–Sun) and calendar month boundaries, in UTC so "today" doesn't
// shift depending on the server's local timezone. All ranges are
// [start, end) — end is exclusive (the first instant of the next period).

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isoWeekBounds(reference = new Date()) {
  const day = startOfUtcDay(reference);
  const weekday = day.getUTCDay() || 7; // Sunday (0) -> 7, so Monday is always day 1
  const start = new Date(day);
  start.setUTCDate(start.getUTCDate() - (weekday - 1));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function previousIsoWeekBounds(reference = new Date()) {
  const { start } = isoWeekBounds(reference);
  const prevStart = new Date(start);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  return { start: prevStart, end: start };
}

export function monthBounds(reference = new Date()) {
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
  const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
  return { start, end };
}

export function previousMonthBounds(reference = new Date()) {
  const { start } = monthBounds(reference);
  const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
  return { start: prevStart, end: start };
}

export function periodBounds(period, reference = new Date()) {
  return period === 'weekly' ? isoWeekBounds(reference) : monthBounds(reference);
}

export function previousPeriodBounds(period, reference = new Date()) {
  return period === 'weekly' ? previousIsoWeekBounds(reference) : previousMonthBounds(reference);
}
