import { clsx } from "clsx"
import { useId, useState } from "react"

// ── Colourful analytics palette ──────────────────────────────────────────────
// The two-series traffic line is red (page views) ↔ blue (visitors) — the most
// contrasting pair and the one the dashboard cares about most. Single-series
// magnitude charts (bars/funnel) use one blue hue; the donut cycles the full
// categorical set. All hues clear ~4:1 contrast on the warm canvas (#f0ede6).
export const SERIES_VIEWS = "#c8384b" // red — page views
export const SERIES_VISITORS = "#2563a8" // blue — visitors
export const PRIMARY = "#2563a8" // blue — single-series magnitude
const CATEGORICAL = ["#2563a8", "#c8384b", "#2f9e5f", "#7c4dbd", "#1c8f8f"]
const MUTED = "#8a8178"
const GRID = "rgba(34,34,34,0.10)"

function niceMax(value: number): number {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  for (const step of steps) {
    if (step * pow >= value) return step * pow
  }
  return 10 * pow
}

// ── Card shell ───────────────────────────────────────────────────────────────
export function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={clsx("admin-card", className)}>
      <h3 className="mb-5 text-xs font-semibold tracking-[0.18em] text-dark/55 uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

// ── Stat tile ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dark/10 bg-light/45 px-5 py-4">
      <p className="text-xs font-semibold tracking-[0.14em] text-dark/45 uppercase">{label}</p>
      <p className="mt-2 text-4xl leading-none font-bold text-dark tabular-nums">{value}</p>
      {sub !== undefined && <div className="mt-2 text-xs text-dark/45">{sub}</div>}
    </div>
  )
}

// ── Traffic line chart (two series) ──────────────────────────────────────────
type TrafficPoint = { label: string; pageViews: number; visitors: number }

export function LineChart({ data }: { data: TrafficPoint[] }) {
  const gradId = useId()
  const titleId = useId()
  const [hover, setHover] = useState<number | null>(null)

  const W = 820
  const H = 300
  const padL = 34
  const padR = 14
  const padT = 14
  const padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const points = data.length > 0 ? data : [{ label: "", pageViews: 0, visitors: 0 }]
  const yMax = niceMax(Math.max(1, ...points.map((p) => Math.max(p.pageViews, p.visitors))))
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0
  const xAt = (i: number) => padL + (points.length > 1 ? i * stepX : innerW / 2)
  const yAt = (v: number) => padT + innerH - (v / yMax) * innerH

  const linePath = (key: "pageViews" | "visitors") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p[key])}`).join(" ")
  const areaPath = (key: "pageViews" | "visitors") =>
    `${linePath(key)} L ${xAt(points.length - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f))
  const labelEvery = Math.ceil(points.length / 8)

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-labelledby={titleId}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = ((e.clientX - rect.left) / rect.width) * W
          const i = Math.round((x - padL) / (stepX || innerW))
          setHover(Math.max(0, Math.min(points.length - 1, i)))
        }}
      >
        <title id={titleId}>Page views and visitors over time</title>
        <defs>
          <linearGradient id={`${gradId}-pv`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_VIEWS} stopOpacity="0.28" />
            <stop offset="100%" stopColor={SERIES_VIEWS} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gradId}-v`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_VISITORS} stopOpacity="0.24" />
            <stop offset="100%" stopColor={SERIES_VISITORS} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke={GRID}
              strokeDasharray="3 4"
            />
            <text x={padL - 8} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill={MUTED}>
              {t}
            </text>
          </g>
        ))}

        <path d={areaPath("pageViews")} fill={`url(#${gradId}-pv)`} />
        <path d={areaPath("visitors")} fill={`url(#${gradId}-v)`} />
        <path d={linePath("pageViews")} fill="none" stroke={SERIES_VIEWS} strokeWidth="2.5" />
        <path d={linePath("visitors")} fill="none" stroke={SERIES_VISITORS} strokeWidth="2.5" />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={i}
              x={xAt(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="11"
              fill={MUTED}
            >
              {p.label}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <g>
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={padT}
              y2={padT + innerH}
              stroke={MUTED}
              strokeWidth="1"
            />
            <circle cx={xAt(hover)} cy={yAt(points[hover].pageViews)} r="4" fill={SERIES_VIEWS} />
            <circle cx={xAt(hover)} cy={yAt(points[hover].visitors)} r="4" fill={SERIES_VISITORS} />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-dark/10 bg-canvas px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(xAt(hover) / W) * 100}%` }}
        >
          <p className="mb-1 font-medium text-dark">{points[hover].label}</p>
          <p className="flex items-center gap-1.5 text-dark/70">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SERIES_VIEWS }}
            />
            {points[hover].pageViews} views
          </p>
          <p className="flex items-center gap-1.5 text-dark/70">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SERIES_VISITORS }}
            />
            {points[hover].visitors} visitors
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-6 text-xs text-dark/60">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: SERIES_VIEWS }}
          />
          Page Views
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: SERIES_VISITORS }}
          />
          Visitors
        </span>
      </div>
    </div>
  )
}

// ── Horizontal bars with an axis (Top Pages) ─────────────────────────────────
export function HBars({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; count: number }>
  emptyLabel: string
}) {
  if (items.length === 0) return <EmptyState label={emptyLabel} />
  const max = niceMax(Math.max(1, ...items.map((i) => i.count)))
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-28 shrink-0 truncate text-right text-sm text-dark/70"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-dark/5">
            <div
              className="h-full rounded"
              style={{ width: `${(item.count / max) * 100}%`, background: PRIMARY, minWidth: 4 }}
            />
          </div>
          <span className="w-8 shrink-0 text-sm font-medium text-dark tabular-nums">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Compact ranked rows (bottom panels) ──────────────────────────────────────
export function RankRows({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; count: number }>
  emptyLabel: string
}) {
  if (items.length === 0) return <EmptyState label={emptyLabel} />
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-dark/75" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-medium text-dark tabular-nums">{item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-dark/5">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.count / max) * 100}%`, background: PRIMARY }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Donut (traffic sources) ──────────────────────────────────────────────────
export function Donut({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; count: number }>
  emptyLabel: string
}) {
  const titleId = useId()
  const total = items.reduce((sum, i) => sum + i.count, 0)
  if (total === 0) return <EmptyState label={emptyLabel} />

  // Fold anything past the 5 palette slots into a single "Other" wedge.
  const shown = items.slice(0, 5)
  const otherCount = items.slice(5).reduce((sum, i) => sum + i.count, 0)
  const segments = otherCount > 0 ? [...shown, { label: "Other", count: otherCount }] : shown

  const r = 60
  const C = 2 * Math.PI * r
  const gap = 2
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5">
      <svg viewBox="0 0 160 160" className="h-44 w-44 -rotate-90" aria-labelledby={titleId}>
        <title id={titleId}>Traffic sources</title>
        {segments.map((seg, i) => {
          const frac = seg.count / total
          const len = Math.max(0, frac * C - gap)
          const dash = `${len} ${C - len}`
          const dashOffset = -offset
          offset += frac * C
          return (
            <circle
              key={seg.label}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={CATEGORICAL[i % CATEGORICAL.length]}
              strokeWidth="20"
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
            />
          )
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-dark/65">
        {segments.map((seg, i) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
            />
            {seg.label}
            <span className="text-dark/40">{Math.round((seg.count / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Conversion funnel ────────────────────────────────────────────────────────
export function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const top = Math.max(1, steps[0]?.value ?? 0)
  return (
    <div className="space-y-4">
      {steps.map((step, i) => {
        const prev = i === 0 ? null : steps[i - 1].value
        const pct = prev && prev > 0 ? (step.value / prev) * 100 : null
        return (
          <div key={step.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-dark">{step.label}</span>
              <span className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold text-dark tabular-nums">{step.value}</span>
                {pct !== null && (
                  <span className="text-xs text-dark/45">{pct.toFixed(1)}% of previous step</span>
                )}
              </span>
            </div>
            <div className="h-7 overflow-hidden rounded-lg bg-dark/5">
              <div
                className="h-full rounded-lg"
                style={{
                  width: `${(step.value / top) * 100}%`,
                  background: PRIMARY,
                  opacity: 1 - i * 0.16,
                  minWidth: step.value > 0 ? 6 : 0,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-dark/40">
      {label}
    </div>
  )
}
