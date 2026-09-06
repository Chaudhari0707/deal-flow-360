const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function currentCalendarDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function isCurrentOrFutureCalendarDate(value: string, now = new Date()) {
  if (!calendarDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    value >= currentCalendarDate(now)
  );
}
