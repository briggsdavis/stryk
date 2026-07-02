// Client-side calendar math for the analytics dashboard. All timezone/DST
// handling lives here so the Convex `getOverview` query can stay pure: it just
// tallies rows into the pre-computed buckets this module produces.

export type RangeKey = "today" | "1w" | "1m" | "3m" | "6m" | "1y" | "2y"

export const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "1w", label: "1 Week" },
  { key: "1m", label: "1 Month" },
  { key: "3m", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "1y", label: "1 Year" },
  { key: "2y", label: "2 Years" },
]

export type Bucket = { start: number; end: number; label: string }
export type BuiltRange = {
  buckets: Bucket[]
  since: number
  until: number
  prevStart: number
  prevEnd: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function addDays(ms: number, days: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

function startOfMonth(year: number, month: number): number {
  return new Date(year, month, 1, 0, 0, 0, 0).getTime()
}

function fmtHour(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric" }).replace(" ", "").toLowerCase()
}
function fmtDay(ms: number): string {
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" })
}
function fmtMonth(ms: number, withYear: boolean): string {
  return new Date(ms).toLocaleDateString(
    [],
    withYear ? { month: "short", year: "2-digit" } : { month: "short" },
  )
}

function hourly(now: number): Bucket[] {
  const dayStart = startOfDay(now)
  const buckets: Bucket[] = []
  for (let start = dayStart; start <= now; start += HOUR) {
    buckets.push({ start, end: start + HOUR, label: fmtHour(start) })
  }
  return buckets
}

function daily(now: number, days: number): Bucket[] {
  const firstDay = addDays(startOfDay(now), -(days - 1))
  const buckets: Bucket[] = []
  for (let i = 0; i < days; i++) {
    const start = addDays(firstDay, i)
    buckets.push({ start, end: start + DAY, label: fmtDay(start) })
  }
  return buckets
}

function weekly(now: number, weeks: number): Bucket[] {
  // Last bucket covers the most recent 7 days (ending today).
  const lastStart = addDays(startOfDay(now), -6)
  const buckets: Bucket[] = []
  for (let i = 0; i < weeks; i++) {
    const start = addDays(lastStart, -(weeks - 1 - i) * 7)
    buckets.push({ start, end: start + 7 * DAY, label: fmtDay(start) })
  }
  return buckets
}

function monthly(now: number, months: number): Bucket[] {
  const d = new Date(now)
  const buckets: Bucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = startOfMonth(d.getFullYear(), d.getMonth() - i)
    const end = startOfMonth(d.getFullYear(), d.getMonth() - i + 1)
    buckets.push({ start, end, label: fmtMonth(start, months > 12) })
  }
  return buckets
}

export function buildRange(range: RangeKey, now: number): BuiltRange {
  let buckets: Bucket[]
  switch (range) {
    case "today":
      buckets = hourly(now)
      break
    case "1w":
      buckets = daily(now, 7)
      break
    case "1m":
      buckets = daily(now, 30)
      break
    case "3m":
      buckets = weekly(now, 13)
      break
    case "6m":
      buckets = weekly(now, 26)
      break
    case "1y":
      buckets = monthly(now, 12)
      break
    case "2y":
      buckets = monthly(now, 24)
      break
  }

  const since = buckets[0].start
  const until = now
  const length = until - since
  return { buckets, since, until, prevStart: since - length, prevEnd: since }
}
