import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react"
import { clsx } from "clsx"
import { useAction, useMutation, useQuery } from "convex/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import {
  ChartCard,
  Donut,
  Funnel,
  HBars,
  LineChart,
  RankRows,
  StatCard,
} from "../../components/admin/charts"
import { ErrorBoundary } from "../../components/ui/error-boundary"
import { Navbar } from "../../components/ui/navbar"
import { buildRange, RANGE_OPTIONS, type RangeKey } from "../../lib/analytics-ranges"
import {
  MAX_POPUP_MEDIA,
  POPUP_ACTION_OPTIONS,
  POPUP_FREQUENCY_OPTIONS,
  POPUP_PAGE_OPTIONS,
  POPUP_POSITION_OPTIONS,
  POPUP_TRIGGER_OPTIONS,
  type PopupAction,
  type PopupFrequency,
  type PopupMediaType,
  type PopupPage,
  type PopupPosition,
  type PopupTriggerType,
} from "../../lib/marketing"

type AuthMode = "signIn" | "signUp"
type AdminSection =
  | "analytics"
  | "announcements"
  | "popups"
  | "pageAbout"
  | "pageGlobal"
  | "catalog"
  | "inquiries"
type AnnouncementScope = "home" | "all"

type PopupMediaItem = { type: PopupMediaType; storageId: Id<"_storage">; url: string | null }

type NavItem = { key: AdminSection; label: string }
type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; label: string; items: NavItem[] }

// Sidebar layout: Analytics first, then the dropdown groups, then the rest.
const NAV: NavEntry[] = [
  { kind: "item", item: { key: "analytics", label: "Analytics" } },
  {
    kind: "group",
    label: "Marketing",
    items: [
      { key: "announcements", label: "Announcement Bar" },
      { key: "popups", label: "Pop-ups" },
    ],
  },
  {
    kind: "group",
    label: "Page Editor",
    items: [
      { key: "pageAbout", label: "About" },
      { key: "pageGlobal", label: "Global / Footer" },
    ],
  },
  { kind: "item", item: { key: "catalog", label: "Catalog Sync" } },
  { kind: "item", item: { key: "inquiries", label: "Inquiries" } },
]

// Which group (if any) owns a section — used to auto-expand the right dropdown.
function groupOf(section: AdminSection): string | null {
  for (const entry of NAV) {
    if (entry.kind === "group" && entry.items.some((i) => i.key === section)) return entry.label
  }
  return null
}

const blankAnnouncement = {
  id: undefined as Id<"announcementBars"> | undefined,
  title: "",
  text: "",
  buttonLabel: "",
  buttonLink: "",
  backgroundColor: "#222222",
  textColor: "#f5f6ee",
  scope: "home" as AnnouncementScope,
  isActive: false,
}

const blankPopup = {
  id: undefined as Id<"popups"> | undefined,
  title: "",
  heading: "",
  text: "",
  buttonEnabled: true,
  buttonLabel: "",
  buttonLink: "",
  emailCaptureEnabled: true,
  delaySeconds: 3,
  frequency: "oncePerSession" as PopupFrequency,
  isActive: false,
  position: "center" as PopupPosition,
  blurBackground: true,
  media: [] as PopupMediaItem[],
  triggerType: "time" as PopupTriggerType,
  pages: ["home"] as PopupPage[],
  action: undefined as PopupAction | undefined,
}

type AnnouncementForm = typeof blankAnnouncement
type PopupForm = typeof blankPopup

export function AdminPage() {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const viewer = useQuery(api.admin.viewer)
  const [mode, setMode] = useState<AuthMode>("signIn")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData(event.currentTarget)
      formData.set("flow", mode)
      await signIn("password", formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not authenticate.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-dark">
      {!isAuthenticated && <Navbar />}
      {isLoading ? (
        <CenteredShell>
          <p className="text-18 text-dark/65">Checking session...</p>
        </CenteredShell>
      ) : isAuthenticated ? (
        viewer === undefined ? (
          <CenteredShell>
            <p className="text-18 text-dark/65">Verifying admin permissions...</p>
          </CenteredShell>
        ) : viewer === null ? (
          <CenteredShell>
            <div className="rounded-lg border border-dark/15 bg-light/45 p-6">
              <p className="mb-2 text-sm tracking-[0.2em] text-dark/55 uppercase">Unauthorized</p>
              <p className="text-sm text-dark/65">
                This account is not allowed to access the admin area.
              </p>
              <button type="button" onClick={() => void signOut()} className="admin-secondary mt-8">
                Sign out
              </button>
            </div>
          </CenteredShell>
        ) : (
          <Dashboard email={viewer.email} onSignOut={() => void signOut()} />
        )
      ) : (
        <CenteredShell>
          <div className="mb-10">
            <p className="mb-3 text-xs tracking-[0.28em] text-dark/55 uppercase">Stryk admin</p>
            <h1 className="text-64">Admin access</h1>
          </div>
          <AuthForm
            mode={mode}
            error={error}
            isSubmitting={isSubmitting}
            onModeChange={(next) => {
              setMode(next)
              setError(null)
            }}
            onSubmit={handleSubmit}
          />
        </CenteredShell>
      )}
    </main>
  )
}

function Dashboard({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [section, setSection] = useState<AdminSection>("analytics")
  // Expanded dropdown groups. Start with the group owning the active section
  // open so its item is visible.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const owner = groupOf("analytics")
    if (owner) initial.add(owner)
    return initial
  })
  const catalogSync = useCatalogSync()

  const go = (next: AdminSection) => {
    setSection(next)
    const owner = groupOf(next)
    if (owner) setExpanded((prev) => new Set(prev).add(owner))
  }

  const toggleGroup = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-dark/10 bg-light/60 px-5 py-6 backdrop-blur md:w-80">
        <button type="button" className="mb-10 text-left" onClick={() => go("analytics")}>
          <img src="/stryk-logo.png" alt="Stryk" className="h-7 w-auto" />
        </button>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((entry) =>
            entry.kind === "item" ? (
              <NavButton
                key={entry.item.key}
                label={entry.item.label}
                active={section === entry.item.key}
                onClick={() => go(entry.item.key)}
              />
            ) : (
              <div key={entry.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(entry.label)}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-xs font-semibold tracking-[0.14em] text-dark/50 uppercase transition-colors hover:bg-dark/5"
                >
                  {entry.label}
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "text-[10px] transition-transform",
                      expanded.has(entry.label) && "rotate-180",
                    )}
                  >
                    ▼
                  </span>
                </button>
                {expanded.has(entry.label) && (
                  <div className="mt-1 mb-1 flex flex-col gap-1 pl-3">
                    {entry.items.map((item) => (
                      <NavButton
                        key={item.key}
                        label={item.label}
                        active={section === item.key}
                        nested
                        onClick={() => go(item.key)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>
        <div className="border-t border-dark/10 pt-5">
          <p className="mb-3 text-xs break-words text-dark/50">{email}</p>
          <button type="button" onClick={onSignOut} className="admin-secondary w-full">
            Sign out
          </button>
        </div>
      </aside>
      <section className="min-h-screen flex-1 pl-72 md:pl-80">
        {/* Sticky action bar - stays pinned at the top while panels scroll. */}
        <div className="sticky top-0 z-30 border-b border-dark/10 bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-8 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  go("catalog")
                  void catalogSync.runSync()
                }}
                disabled={catalogSync.isSyncing}
                className="inline-flex items-center gap-2 rounded-lg bg-dark px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "text-base leading-none",
                    catalogSync.isSyncing && "animate-spin",
                  )}
                >
                  ⟳
                </span>
                {catalogSync.isSyncing ? "Syncing..." : "Sync catalog"}
              </button>
              <button type="button" className="admin-secondary">
                Shopify store
              </button>
            </div>
            <Link to="/" className="admin-secondary gap-1.5">
              <span aria-hidden="true">←</span> Back to site
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-8 py-10">
          {/* Keyed by section so switching tabs clears a previously caught
              error and retries the panel. Without this, a throw in one panel
              (e.g. a failing Convex query) would unmount the whole dashboard. */}
          <ErrorBoundary key={section} fallback={(error) => <PanelError error={error} />}>
            {section === "analytics" && <AnalyticsPanel />}
            {section === "announcements" && <AnnouncementsPanel />}
            {section === "popups" && <PopupsPanel />}
            {section === "pageAbout" && (
              <Placeholder title="About" eyebrow="Page editor">
                Controls for editing the About page will live here.
              </Placeholder>
            )}
            {section === "pageGlobal" && (
              <Placeholder title="Global / Footer" eyebrow="Page editor">
                Controls for site-wide footer and global content will live here.
              </Placeholder>
            )}
            {section === "catalog" && <CatalogSyncPanel sync={catalogSync} />}
            {section === "inquiries" && <InquiriesPanel />}
          </ErrorBoundary>
        </div>
      </section>
    </div>
  )
}

function NavButton({
  label,
  active,
  nested = false,
  onClick,
}: {
  label: string
  active: boolean
  nested?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "rounded-lg px-4 py-2.5 text-left text-sm font-medium transition-colors",
        nested && "py-2",
        active ? "bg-dark text-white" : "text-dark/65 hover:bg-dark/5",
      )}
    >
      {label}
    </button>
  )
}

// Shown when a dashboard panel throws (most often a Convex query that failed
// because functions aren't deployed, or stored data that no longer matches the
// schema). Surfaces the message instead of letting the panel vanish.
function PanelError({ error }: { error: Error }) {
  return (
    <section>
      <AdminHeader title="Something went wrong" eyebrow="Panel error" />
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
        <p className="mb-3 text-sm text-dark/75">
          This panel hit an error and couldn't load. The details below usually point at the cause.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-dark/5 p-4 text-xs leading-5 text-red-700">
          {error.message}
        </pre>
      </div>
    </section>
  )
}

function Placeholder({
  title,
  eyebrow = "Coming next",
  children,
}: {
  title: string
  eyebrow?: string
  children?: React.ReactNode
}) {
  return (
    <section>
      <AdminHeader title={title} eyebrow={eyebrow} />
      <div className="rounded-lg border border-dark/10 bg-light/45 p-8">
        <p className="text-sm text-dark/60">
          {children ?? "This dashboard section is reserved for future editing controls."}
        </p>
      </div>
    </section>
  )
}

type CatalogSync = ReturnType<typeof useCatalogSync>

// Shared Shopify sync so both the sticky top-nav button and the Catalog Sync
// panel drive - and report on - the same run.
function useCatalogSync() {
  const syncCatalogPage = useAction(api.shopify.syncCatalogPageForAdmin)
  const finalizeCatalogSync = useAction(api.shopify.finalizeCatalogSyncForAdmin)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSync = useCallback(async () => {
    setIsSyncing(true)
    setMessage("Starting Shopify sync...")
    setError(null)

    try {
      let after: string | undefined
      let pageCount = 0
      let productCount = 0
      let collectionCount = 0
      let hasNextPage = true
      let syncStartedAt: number | undefined

      while (hasNextPage) {
        // eslint-disable-next-line no-await-in-loop
        const result = await syncCatalogPage({ first: 25, after, syncStartedAt })
        syncStartedAt = result.syncStartedAt
        pageCount += 1
        productCount += result.productCount
        collectionCount += result.collectionCount
        hasNextPage = result.hasNextPage && !!result.nextCursor
        after = result.nextCursor ?? undefined
        setMessage(`Synced ${productCount} products across ${pageCount} page(s)...`)
      }

      if (syncStartedAt === undefined) throw new Error("Shopify sync did not start.")
      setMessage("Finalizing sync and pruning deleted Shopify products...")
      const cleanup = await finalizeCatalogSync({ syncStartedAt })

      setMessage(
        `Sync complete. Updated ${productCount} products and ${collectionCount} collection links. Hid ${cleanup.hiddenProductCount} stale products, ${cleanup.hiddenCollectionCount} stale collections, and ${cleanup.hiddenFacetOptionCount} stale filters.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shopify sync failed.")
      setMessage(null)
    } finally {
      setIsSyncing(false)
    }
  }, [syncCatalogPage, finalizeCatalogSync])

  return { runSync, isSyncing, message, error }
}

function CatalogSyncPanel({ sync }: { sync: CatalogSync }) {
  const { runSync, isSyncing, message, error } = sync

  return (
    <section className="space-y-8">
      <AdminHeader title="Catalog Sync" eyebrow="Shopify products" />
      <div className="admin-card">
        <PanelTitle title="Sync from Shopify" />
        <p className="mb-5 max-w-2xl text-sm leading-6 text-dark/60">
          Pull the latest Shopify products, variants, images, prices, and collection membership into
          Convex.
        </p>
        <button type="button" className="admin-primary" disabled={isSyncing} onClick={runSync}>
          {isSyncing ? "Syncing..." : "Run Shopify sync"}
        </button>
        {message && (
          <p className="mt-4 rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
      </div>
    </section>
  )
}

function AnalyticsPanel() {
  const [range, setRange] = useState<RangeKey>("1w")
  // Re-anchor "now" whenever the range changes so switching tabs refreshes the
  // window (and buckets) to the current moment.
  const now = useMemo(() => Date.now(), [range])
  const built = useMemo(() => buildRange(range, now), [range, now])
  const data = useQuery(api.analytics.getOverview, {
    buckets: built.buckets,
    prevStart: built.prevStart,
    prevEnd: built.prevEnd,
  })

  const totals = data?.totals
  const prior = data?.prior

  // Prior-period comparison line under a stat card. Only page views, visitors,
  // and checkout clicks carry a prior baseline; the rest show a neutral note.
  const priorSub = (current: number | undefined, previous: number | undefined) => {
    if (!prior?.hasPrior || previous === undefined || current === undefined)
      return "— no prior data"
    if (previous === 0) return "— no prior data"
    const pct = ((current - previous) / previous) * 100
    const up = pct >= 0
    return (
      <span className={up ? "text-emerald-600" : "text-red-600"}>
        {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs. prior
      </span>
    )
  }

  return (
    <section className="space-y-8">
      <AdminHeader title="Analytics" eyebrow="Traffic, conversion & paths" />

      {/* Time-range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setRange(option.key)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              range === option.key
                ? "border-[#b5502f] bg-[#b5502f] text-white"
                : "border-dark/15 text-dark/65 hover:border-dark/35",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p className="text-sm text-dark/55">Loading analytics...</p>
      ) : (
        <>
          {data.truncated && (
            <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              This range has a very high number of events — figures below are a sample of the most
              recent activity. Pick a shorter range for exact counts.
            </p>
          )}

          {/* Stat tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Page Views"
              value={(totals?.pageViews ?? 0).toLocaleString()}
              sub={priorSub(totals?.pageViews, prior?.pageViews)}
            />
            <StatCard
              label="Visitors"
              value={(totals?.visitors ?? 0).toLocaleString()}
              sub={priorSub(totals?.visitors, prior?.visitors)}
            />
            <StatCard
              label="Product Views"
              value={(totals?.productViews ?? 0).toLocaleString()}
              sub="— no prior data"
            />
            <StatCard
              label="Add to Cart"
              value={(totals?.addToCarts ?? 0).toLocaleString()}
              sub="— no prior data"
            />
            <StatCard
              label="Checkout Clicks"
              value={(totals?.checkoutClicks ?? 0).toLocaleString()}
              sub={priorSub(totals?.checkoutClicks, prior?.checkoutClicks)}
            />
            <StatCard
              label="Checkout Rate"
              value={`${((totals?.conversionRate ?? 0) * 100).toFixed(1)}%`}
              sub="of visitors"
            />
          </div>

          {/* Traffic over time */}
          <ChartCard title="Traffic Over Time">
            <LineChart data={data.trafficBuckets} />
          </ChartCard>

          {/* Top pages + sources */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Top Pages">
              <HBars items={data.topPages} emptyLabel="No page views yet." />
            </ChartCard>
            <ChartCard title="Where Views Come From">
              <Donut items={data.sources} emptyLabel="No page views yet." />
            </ChartCard>
          </div>

          {/* Conversion funnel */}
          <ChartCard title="Conversion Funnel">
            <p className="mb-5 text-sm text-dark/55">
              Order = clicked through to Shopify checkout; completed purchases happen on Shopify and
              aren&apos;t tracked here.
            </p>
            <Funnel
              steps={[
                { label: "Visited site", value: data.funnel.visited },
                { label: "Viewed a product", value: data.funnel.viewedProduct },
                { label: "Added to cart", value: data.funnel.addedToCart },
                { label: "Clicked checkout", value: data.funnel.checkout },
              ]}
            />
          </ChartCard>

          {/* Breakdowns */}
          <div className="grid gap-6 lg:grid-cols-3">
            <ChartCard title="Checkout Clicks by Source">
              <RankRows items={data.checkoutBySource} emptyLabel="No data yet." />
            </ChartCard>
            <ChartCard title="Top Added-to-Cart Products">
              <RankRows items={data.topAddedProducts} emptyLabel="No data yet." />
            </ChartCard>
            <ChartCard title="Other CTA Clicks">
              <RankRows items={data.ctaClicks} emptyLabel="No data yet." />
            </ChartCard>
          </div>
        </>
      )}
    </section>
  )
}

function AnnouncementsPanel() {
  const announcements = useQuery(api.marketing.listAnnouncements)
  const saveAnnouncement = useMutation(api.marketing.saveAnnouncement)
  const setActive = useMutation(api.marketing.setAnnouncementActive)
  const deleteAnnouncement = useMutation(api.marketing.deleteAnnouncement)
  const [message, setMessage] = useState<string | null>(null)
  // The announcement currently open in the edit modal.
  const [editing, setEditing] = useState<AnnouncementForm | null>(null)

  const persist = async (form: AnnouncementForm) => {
    await saveAnnouncement({
      ...form,
      buttonLabel: form.buttonLabel || undefined,
      buttonLink: form.buttonLink || undefined,
    })
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-48">Announcement Bar</h1>
          <p className="mt-2 text-sm text-dark/55">
            Only one bar can be active at a time. Activating one turns the others off.
          </p>
        </div>
        <button
          type="button"
          className="admin-primary"
          onClick={() => setEditing(blankAnnouncement)}
        >
          + New bar
        </button>
      </div>
      {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}

      <div className="space-y-3">
        {announcements === undefined && <p className="text-sm text-dark/55">Loading...</p>}
        {announcements?.length === 0 && (
          <p className="rounded-lg border border-dashed border-dark/15 px-5 py-8 text-center text-sm text-dark/45">
            No announcement bars yet. Create one to get started.
          </p>
        )}
        {announcements?.map((announcement) => (
          <div
            key={announcement._id}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-dark/10 bg-light/45 p-4"
          >
            <div className="min-w-[16rem] flex-1">
              <AnnouncementPreview
                text={announcement.text}
                buttonLabel={announcement.buttonLabel}
                backgroundColor={announcement.backgroundColor}
                textColor={announcement.textColor}
              />
            </div>
            <div className="min-w-[7rem]">
              <p className="font-medium text-dark">{announcement.title || "Untitled"}</p>
              <p className="text-sm text-dark/45">
                {announcement.scope === "home" ? "Home page only" : "All pages"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-dark/70">
                <input
                  type="checkbox"
                  checked={announcement.isActive}
                  onChange={(e) =>
                    void setActive({ id: announcement._id, isActive: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#b5502f]"
                />
                {announcement.isActive ? "On" : "Off"}
              </label>
              <button
                type="button"
                className="admin-secondary"
                onClick={() =>
                  setEditing({
                    id: announcement._id,
                    title: announcement.title,
                    text: announcement.text,
                    buttonLabel: announcement.buttonLabel ?? "",
                    buttonLink: announcement.buttonLink ?? "",
                    backgroundColor: announcement.backgroundColor,
                    textColor: announcement.textColor,
                    scope: announcement.scope === "off" ? "home" : announcement.scope,
                    isActive: announcement.isActive,
                  })
                }
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-secondary border-red-500/40 text-red-600 hover:bg-red-500 hover:text-white"
                onClick={() => void deleteAnnouncement({ id: announcement._id })}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit announcement" : "New announcement"}
          eyebrow="Announcement bar"
          onClose={() => setEditing(null)}
        >
          <AnnouncementEditor
            key={editing.id ?? "new"}
            initial={editing}
            submitLabel={editing.id ? "Save changes" : "Create announcement"}
            showActiveToggle
            onCancel={() => setEditing(null)}
            onSave={async (form) => {
              await persist(form)
              setEditing(null)
              setMessage(form.id ? "Announcement updated." : "Announcement created.")
            }}
          />
        </Modal>
      )}
    </section>
  )
}

// A faithful mini-render of the live announcement bar, used as the row preview.
function AnnouncementPreview({
  text,
  buttonLabel,
  backgroundColor,
  textColor,
}: {
  text: string
  buttonLabel?: string
  backgroundColor: string
  textColor: string
}) {
  return (
    <div
      className="flex items-center justify-center gap-3 rounded-lg px-5 py-3 text-center text-sm font-medium"
      style={{ backgroundColor, color: textColor }}
    >
      <span className="truncate">{text || "Announcement text"}</span>
      {buttonLabel && (
        <span
          className="shrink-0 rounded-full px-3 py-1 text-xs"
          style={{ border: `1px solid ${textColor}`, color: textColor }}
        >
          {buttonLabel}
        </span>
      )}
    </div>
  )
}

// Reusable announcement form. Owns its draft state seeded from `initial`, so it
// serves both the inline "new" form and the edit modal.
function AnnouncementEditor({
  initial,
  submitLabel,
  showActiveToggle = false,
  onSave,
  onCancel,
}: {
  initial: AnnouncementForm
  submitLabel: string
  showActiveToggle?: boolean
  onSave: (form: AnnouncementForm) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave(form)
      if (!form.id) setForm(initial)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <TextInput
        label="Internal title"
        value={form.title}
        onChange={(title) => setForm((prev) => ({ ...prev, title }))}
        required
      />
      <TextInput
        label="Announcement text"
        value={form.text}
        onChange={(text) => setForm((prev) => ({ ...prev, text }))}
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Button label"
          value={form.buttonLabel}
          onChange={(buttonLabel) => setForm((prev) => ({ ...prev, buttonLabel }))}
        />
        <TextInput
          label="Button link"
          value={form.buttonLink}
          onChange={(buttonLink) => setForm((prev) => ({ ...prev, buttonLink }))}
        />
        <ColorInput
          label="Background color"
          value={form.backgroundColor}
          onChange={(backgroundColor) => setForm((prev) => ({ ...prev, backgroundColor }))}
        />
        <ColorInput
          label="Text color"
          value={form.textColor}
          onChange={(textColor) => setForm((prev) => ({ ...prev, textColor }))}
        />
      </div>
      <SelectInput
        label="Show on"
        value={form.scope}
        onChange={(scope) => setForm((prev) => ({ ...prev, scope }))}
        options={[
          { value: "home", label: "Home page only" },
          { value: "all", label: "Every page" },
        ]}
      />
      {showActiveToggle && (
        <SwitchInput
          label="Active"
          description="Only one announcement can be live at a time."
          checked={form.isActive}
          onChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
        />
      )}
      <div className="flex gap-2">
        <button type="submit" className="admin-primary" disabled={saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="admin-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function useMediaUploader() {
  const generateUploadUrl = useMutation(api.marketing.generateUploadUrl)
  return useCallback(
    async (file: File) => {
      const uploadUrl = await generateUploadUrl()
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!res.ok) throw new Error("Upload failed")
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> }
      return storageId
    },
    [generateUploadUrl],
  )
}

function popupToForm(
  popup: NonNullable<ReturnType<typeof useQuery<typeof api.marketing.listPopups>>>[number],
): PopupForm {
  return {
    id: popup._id,
    title: popup.title,
    heading: popup.heading,
    text: popup.text,
    // Legacy rows have no flag - infer it from whether a button was configured.
    buttonEnabled: popup.buttonEnabled ?? (popup.buttonLabel !== "" && popup.buttonLink !== ""),
    buttonLabel: popup.buttonLabel,
    buttonLink: popup.buttonLink,
    emailCaptureEnabled: popup.emailCaptureEnabled,
    delaySeconds: popup.delaySeconds,
    frequency: popup.frequency,
    isActive: popup.isActive,
    position: popup.position,
    blurBackground: popup.blurBackground,
    media: popup.media.map((m) => ({ type: m.type, storageId: m.storageId, url: m.url })),
    triggerType: popup.triggerType ?? "time",
    pages: popup.pages ?? ["home"],
    action: popup.action,
  }
}

function PopupsPanel() {
  const popups = useQuery(api.marketing.listPopups)
  const savePopup = useMutation(api.marketing.savePopup)
  const setActive = useMutation(api.marketing.setPopupActive)
  const deletePopup = useMutation(api.marketing.deletePopup)
  const [message, setMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState<PopupForm | null>(null)

  const persist = async (form: PopupForm) => {
    return await savePopup({
      id: form.id,
      title: form.title,
      heading: form.heading,
      text: form.text,
      buttonEnabled: form.buttonEnabled,
      // When the button is off, store empty label/link so nothing lingers.
      buttonLabel: form.buttonEnabled ? form.buttonLabel : "",
      buttonLink: form.buttonEnabled ? form.buttonLink : "",
      emailCaptureEnabled: form.emailCaptureEnabled,
      delaySeconds: form.delaySeconds,
      frequency: form.frequency,
      isActive: form.isActive,
      position: form.position,
      blurBackground: form.blurBackground,
      media: form.media.map(({ type, storageId }) => ({ type, storageId })),
      triggerType: form.triggerType,
      // Action pop-ups fire wherever the action occurs, so page targeting is
      // cleared; time pop-ups have no action.
      pages: form.triggerType === "action" ? [] : form.pages,
      action: form.triggerType === "action" ? form.action : undefined,
    })
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-48">Pop-up</h1>
          <p className="mt-2 text-sm text-dark/55">
            Two active pop-ups can&apos;t occupy the same position.
          </p>
        </div>
        <button type="button" className="admin-primary" onClick={() => setEditing(blankPopup)}>
          + New pop-up
        </button>
      </div>
      {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}

      <div className="space-y-3">
        {popups === undefined && <p className="text-sm text-dark/55">Loading...</p>}
        {popups?.length === 0 && (
          <p className="rounded-lg border border-dashed border-dark/15 px-5 py-8 text-center text-sm text-dark/45">
            No pop-ups yet. Create one to get started.
          </p>
        )}
        {popups?.map((popup) => (
          <div
            key={popup._id}
            className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-dark/10 bg-light/45 p-4"
          >
            <div className="flex min-w-[16rem] flex-1 items-center gap-4">
              {popup.media[0] ? (
                popup.media[0].type === "video" ? (
                  <video
                    src={popup.media[0].url ?? undefined}
                    aria-label="Video thumbnail"
                    muted
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <img
                    src={popup.media[0].url ?? undefined}
                    alt=""
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                  />
                )
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-dark/5 text-dark/30">
                  ▢
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-medium text-dark">
                  {popup.title || popup.heading || "Untitled"}
                </p>
                <p className="mt-0.5 truncate text-sm text-dark/45">
                  {describePopupSummary(popup)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-dark/70">
                <input
                  type="checkbox"
                  checked={popup.isActive}
                  onChange={(e) => void setActive({ id: popup._id, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[#b5502f]"
                />
                {popup.isActive ? "On" : "Off"}
              </label>
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setEditing(popupToForm(popup))}
              >
                Edit
              </button>
              <button
                type="button"
                className="admin-secondary border-red-500/40 text-red-600 hover:bg-red-500 hover:text-white"
                onClick={() => void deletePopup({ id: popup._id })}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={editing.id ? "Edit pop-up" : "New pop-up"}
          eyebrow="Pop-up"
          onClose={() => setEditing(null)}
        >
          <PopupEditor
            key={editing.id ?? "new"}
            initial={editing}
            submitLabel={editing.id ? "Save changes" : "Create pop-up"}
            showActiveToggle
            onCancel={() => setEditing(null)}
            onSave={async (form) => {
              await persist(form)
              setEditing(null)
              setMessage(form.id ? "Pop-up updated." : "Pop-up created.")
            }}
          />
        </Modal>
      )}
    </section>
  )
}

// One-line summary for a pop-up row: position · frequency · trigger · capture.
function describePopupSummary(popup: {
  position: PopupPosition
  frequency: PopupFrequency
  emailCaptureEnabled: boolean
  delaySeconds: number
  triggerType?: PopupTriggerType
  action?: PopupAction
  pages?: PopupPage[]
}): string {
  const position = popup.position
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  const frequency = POPUP_FREQUENCY_OPTIONS.find((o) => o.value === popup.frequency)?.label ?? ""
  const trigger =
    popup.triggerType === "action" ? describeTrigger(popup) : `after ${popup.delaySeconds}s`
  const parts = [position, frequency, trigger]
  if (popup.emailCaptureEnabled) parts.push("email capture")
  return parts.filter(Boolean).join(" · ")
}

// Human-readable trigger summary for the saved-pop-up list.
function describeTrigger(popup: {
  triggerType?: PopupTriggerType
  action?: PopupAction
  pages?: PopupPage[]
}): string {
  if (popup.triggerType === "action") {
    const label = POPUP_ACTION_OPTIONS.find((o) => o.value === popup.action)?.label
    return label ? label.toLowerCase() : "on action"
  }
  const pages = popup.pages ?? ["home"]
  return pages.length === POPUP_PAGE_OPTIONS.length ? "all pages" : pages.join(", ") || "no pages"
}

// Reusable pop-up form. Owns its draft state (including media uploads) seeded
// from `initial`, so it serves both the inline "new" form and the edit modal.
function PopupEditor({
  initial,
  submitLabel,
  showActiveToggle = false,
  onSave,
  onCancel,
}: {
  initial: PopupForm
  submitLabel: string
  showActiveToggle?: boolean
  onSave: (form: PopupForm) => Promise<Id<"popups"> | void>
  onCancel?: () => void
}) {
  const upload = useMediaUploader()
  const [form, setForm] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAction = form.triggerType === "action"

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const saved = await onSave(form)
      // Newly created pop-up: keep the entered values on screen (so toggles like
      // "Blur" visibly stick) and bind the form to the new row instead of wiping
      // it back to defaults, which read as the save being undone.
      if (!form.id && saved) setForm((prev) => ({ ...prev, id: saved }))
    } catch (err) {
      // A failed save must never look like it succeeded - surface it instead of
      // swallowing the rejection, which left toggles (e.g. blur/dim) silently
      // reverted with no indication the change didn't persist.
      setError(err instanceof Error ? err.message : "Save failed. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const room = MAX_POPUP_MEDIA - form.media.length
      const picked = Array.from(files).slice(0, Math.max(0, room))
      const uploaded: PopupMediaItem[] = []
      for (const file of picked) {
        const type: PopupMediaType = file.type.startsWith("video") ? "video" : "image"
        const storageId = await upload(file)
        uploaded.push({ type, storageId, url: URL.createObjectURL(file) })
      }
      setForm((prev) => ({ ...prev, media: [...prev.media, ...uploaded] }))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const moveMedia = (index: number, dir: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev.media]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, media: next }
    })
  }

  const removeMedia = (index: number) => {
    setForm((prev) => ({ ...prev, media: prev.media.filter((_, i) => i !== index) }))
  }

  const togglePage = (page: PopupPage) => {
    setForm((prev) => {
      const has = prev.pages.includes(page)
      return { ...prev, pages: has ? prev.pages.filter((p) => p !== page) : [...prev.pages, page] }
    })
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">
        Carousel media (up to {MAX_POPUP_MEDIA})
      </span>
      <div className="mb-5 flex flex-wrap gap-3">
        {form.media.map((item, index) => (
          <div
            key={`${item.storageId}-${index}`}
            className="relative h-24 w-24 overflow-hidden rounded-lg border border-dark/15 bg-dark/5"
          >
            {item.type === "video" ? (
              <video
                src={item.url ?? undefined}
                aria-label="Video preview"
                className="h-full w-full object-cover"
                muted
              />
            ) : (
              <img src={item.url ?? undefined} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute top-1 left-1 rounded bg-dark/70 px-1.5 py-0.5 text-[10px] text-white uppercase">
              {item.type}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-dark/55 px-1 py-0.5">
              <button
                type="button"
                aria-label="Move earlier"
                className="text-xs text-white disabled:opacity-30"
                disabled={index === 0}
                onClick={() => moveMedia(index, -1)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Remove media"
                className="text-xs text-white"
                onClick={() => removeMedia(index)}
              >
                ✕
              </button>
              <button
                type="button"
                aria-label="Move later"
                className="text-xs text-white disabled:opacity-30"
                disabled={index === form.media.length - 1}
                onClick={() => moveMedia(index, 1)}
              >
                ›
              </button>
            </div>
          </div>
        ))}
        {form.media.length < MAX_POPUP_MEDIA && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-dashed border-dark/25 text-xs text-dark/55 transition-colors hover:border-dark/45 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "+ Add"}
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload carousel media"
        accept="image/*,video/mp4"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <TextInput
        label="Internal title"
        value={form.title}
        onChange={(title) => setForm((prev) => ({ ...prev, title }))}
        required
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          label="Heading"
          value={form.heading}
          onChange={(heading) => setForm((prev) => ({ ...prev, heading }))}
        />
        <TextInput
          label="Text"
          value={form.text}
          onChange={(text) => setForm((prev) => ({ ...prev, text }))}
        />
        <SelectInput
          label="Position"
          value={form.position}
          onChange={(position) => setForm((prev) => ({ ...prev, position }))}
          options={POPUP_POSITION_OPTIONS}
        />
        <SelectInput
          label="Display frequency"
          value={form.frequency}
          onChange={(frequency) => setForm((prev) => ({ ...prev, frequency }))}
          options={POPUP_FREQUENCY_OPTIONS}
        />
      </div>

      {/* Call-to-action button - optional; not every pop-up needs one. */}
      <SwitchInput
        label="Show button"
        description="Turn off for pop-ups that don't need a call-to-action button."
        checked={form.buttonEnabled}
        onChange={(buttonEnabled) => setForm((prev) => ({ ...prev, buttonEnabled }))}
      />
      {form.buttonEnabled && (
        <div className="mb-5 grid gap-4 md:grid-cols-2">
          <TextInput
            label="Button label"
            value={form.buttonLabel}
            onChange={(buttonLabel) => setForm((prev) => ({ ...prev, buttonLabel }))}
          />
          <TextInput
            label="Button link"
            value={form.buttonLink}
            onChange={(buttonLink) => setForm((prev) => ({ ...prev, buttonLink }))}
          />
        </div>
      )}

      {/* Trigger: time-on-page (with page targeting) OR a user action. The two
          are mutually exclusive — switching clears the other side's settings. */}
      <div className="mt-2 mb-5 rounded-lg border border-dark/10 p-4">
        <SelectInput
          label="Trigger"
          value={form.triggerType}
          onChange={(triggerType) =>
            setForm((prev) => ({
              ...prev,
              triggerType,
              action: triggerType === "action" ? (prev.action ?? "product") : undefined,
            }))
          }
          options={POPUP_TRIGGER_OPTIONS}
        />
        {isAction ? (
          <SelectInput
            label="Fires on"
            value={form.action ?? "product"}
            onChange={(action) => setForm((prev) => ({ ...prev, action }))}
            options={POPUP_ACTION_OPTIONS}
          />
        ) : (
          <>
            <NumberInput
              label="Show after seconds"
              value={form.delaySeconds}
              onChange={(delaySeconds) => setForm((prev) => ({ ...prev, delaySeconds }))}
            />
            <CheckboxGroup
              label="Show on pages"
              options={POPUP_PAGE_OPTIONS}
              selected={form.pages}
              onToggle={togglePage}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {showActiveToggle && (
          <SwitchInput
            label="Active"
            checked={form.isActive}
            onChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
          />
        )}
        <SwitchInput
          label="Email capture"
          checked={form.emailCaptureEnabled}
          onChange={(emailCaptureEnabled) => setForm((prev) => ({ ...prev, emailCaptureEnabled }))}
        />
        <SwitchInput
          label="Blur / dim the page behind"
          checked={form.blurBackground}
          onChange={(blurBackground) => setForm((prev) => ({ ...prev, blurBackground }))}
        />
      </div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="admin-primary" disabled={uploading || saving}>
          {saving ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="admin-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

type InquiryTab = "contact" | "captures"
type InquiryTypeFilter = "all" | "general" | "custom" | "order"

const INQUIRY_TYPE_FILTERS: Array<{ value: InquiryTypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
  { value: "order", label: "Order" },
]

function InquiriesPanel() {
  const [tab, setTab] = useState<InquiryTab>("contact")
  // Fetched here for the top count cards; the child list components re-use the
  // same (deduped) Convex subscriptions for their own rendering.
  const contactInquiries = useQuery(api.inquiries.listContactInquiries)
  const emailCaptures = useQuery(api.inquiries.listPopupEmailCaptures)

  const count = (rows: unknown[] | undefined) => (rows === undefined ? "—" : rows.length.toString())

  return (
    <section className="space-y-8">
      <AdminHeader title="Inquiries" eyebrow="Contact form and email captures" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Contact Form" value={count(contactInquiries)} />
        <StatCard label="Email Captures" value={count(emailCaptures)} />
      </div>

      <div className="inline-flex rounded-full border border-dark/15 p-1">
        {(
          [
            { key: "contact", label: "Contact Form" },
            { key: "captures", label: "Email Captures" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === item.key ? "bg-[#b5502f] text-white" : "text-dark/60 hover:bg-dark/5",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "contact" ? <ContactInquiries /> : <EmailCaptures />}
    </section>
  )
}

function ContactInquiries() {
  const inquiries = useQuery(api.inquiries.listContactInquiries)
  const updateStatus = useMutation(api.inquiries.updateInquiryStatus)
  const [search, setSearch] = useState("")
  const [type, setType] = useState<InquiryTypeFilter>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const filtered = useMemo(() => {
    if (!inquiries) return inquiries
    const term = search.trim().toLowerCase()
    // `to` is inclusive of the whole selected day.
    const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : null
    const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : null
    return inquiries.filter((item) => {
      if (type !== "all" && item.inquiryType !== type) return false
      if (fromTs !== null && item._creationTime < fromTs) return false
      if (toTs !== null && item._creationTime > toTs) return false
      if (term) {
        const haystack = `${item.firstName} ${item.lastName} ${item.email}`.toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [inquiries, search, type, from, to])

  return (
    <div className="admin-card">
      <PanelTitle title="Contact form submissions" />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextInput label="Search name or email" value={search} onChange={setSearch} />
        <SelectInput label="Type" value={type} onChange={setType} options={INQUIRY_TYPE_FILTERS} />
        <TextInput label="From date" type="date" value={from} onChange={setFrom} />
        <TextInput label="To date" type="date" value={to} onChange={setTo} />
      </div>

      <div className="space-y-3">
        {filtered === undefined && <p className="text-sm text-dark/55">Loading...</p>}
        {filtered?.length === 0 && <p className="text-sm text-dark/55">No matching messages.</p>}
        {filtered?.map((item) => {
          const isNew = item.status === "new"
          return (
            <article
              key={item._id}
              className={clsx(
                "rounded-lg border p-4 transition-colors",
                isNew ? "border-emerald-500/40 bg-emerald-500/5" : "border-dark/10",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-medium">
                  {item.firstName} {item.lastName}
                  {isNew && (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                      New
                    </span>
                  )}
                </p>
                <span className="rounded-full bg-dark/5 px-3 py-1 text-xs text-dark/55 uppercase">
                  {item.inquiryType}
                </span>
              </div>
              <p className="text-sm text-dark/55">{item.email}</p>
              {item.phone && <p className="text-sm text-dark/55">{item.phone}</p>}
              {(item.reference || item.size) && (
                <p className="mt-2 text-sm text-dark/55">
                  {[item.reference, item.size].filter(Boolean).join(" / ")}
                </p>
              )}
              <p className="mt-3 text-sm leading-6 text-dark/75">{item.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-dark/45">
                <span>{new Date(item._creationTime).toLocaleString()}</span>
                {isNew ? (
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => void updateStatus({ id: item._id, status: "read" })}
                  >
                    Mark as read
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => void updateStatus({ id: item._id, status: "new" })}
                  >
                    Mark as unread
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function EmailCaptures() {
  const popupEmails = useQuery(api.inquiries.listPopupEmailCaptures)
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("all")
  const [copied, setCopied] = useState(false)

  const sources = useMemo(() => {
    if (!popupEmails) return []
    return [...new Set(popupEmails.map((item) => item.source))].sort()
  }, [popupEmails])

  const filtered = useMemo(() => {
    if (!popupEmails) return popupEmails
    const term = search.trim().toLowerCase()
    return popupEmails.filter((item) => {
      if (source !== "all" && item.source !== source) return false
      if (term && !item.email.toLowerCase().includes(term)) return false
      return true
    })
  }, [popupEmails, search, source])

  const downloadCsv = () => {
    if (!filtered) return
    const rows = [
      ["email", "source", "captured_at"],
      ...filtered.map((item) => [
        item.email,
        item.source,
        new Date(item._creationTime).toISOString(),
      ]),
    ]
    // Quote every field so commas/quotes in values can't break columns.
    const csv = rows
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `email-captures-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyEmails = async () => {
    if (!filtered) return
    try {
      await navigator.clipboard.writeText(filtered.map((item) => item.email).join(", "))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (permissions/insecure context) — silently ignore.
    }
  }

  return (
    <div className="admin-card">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search emails"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="min-w-[10rem] flex-1 rounded-lg border border-dark/15 bg-canvas px-4 py-2.5 text-sm outline-none focus:border-dark/45"
        />
        <select
          aria-label="Filter by source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="min-w-[12rem] rounded-lg border border-dark/15 bg-canvas px-4 py-2.5 text-sm outline-none focus:border-dark/45"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-secondary"
          onClick={downloadCsv}
          disabled={!filtered || filtered.length === 0}
        >
          Download CSV
        </button>
        <button
          type="button"
          className="admin-secondary"
          onClick={() => void copyEmails()}
          disabled={!filtered || filtered.length === 0}
        >
          {copied ? "Copied!" : "Copy emails"}
        </button>
        <span className="text-sm text-dark/45">
          {filtered === undefined ? "" : `${filtered.length} result(s)`}
        </span>
      </div>

      <div className="divide-y divide-dark/10">
        {filtered === undefined && <p className="text-sm text-dark/55">Loading...</p>}
        {filtered?.length === 0 && (
          <p className="py-3 text-sm text-dark/45">No email captures yet.</p>
        )}
        {filtered?.map((item) => (
          <div
            key={item._id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <span className="font-medium text-dark">{item.email}</span>
            <span className="flex items-center gap-3 text-dark/45">
              <span className="rounded-full bg-dark/5 px-2.5 py-0.5 text-xs">{item.source}</span>
              {new Date(item._creationTime).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AuthForm({
  mode,
  error,
  isSubmitting,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode
  error: string | null
  isSubmitting: boolean
  onModeChange: (mode: AuthMode) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-dark/15 bg-light/45 p-6">
      <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-lg border border-dark/15">
        {(["signIn", "signUp"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => onModeChange(nextMode)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              mode === nextMode ? "bg-dark text-white" : "text-dark/70 hover:bg-dark/5"
            }`}
          >
            {nextMode === "signIn" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <TextInput label="Email" name="email" type="email" autoComplete="email" required />
      <TextInput
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "signIn" ? "current-password" : "new-password"}
        minLength={8}
        required
      />
      {error && <p className="mb-5 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-dark px-5 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50"
      >
        {isSubmitting ? "Please wait..." : mode === "signIn" ? "Sign in" : "Create admin account"}
      </button>
    </form>
  )
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-28">
      {children}
    </section>
  )
}

function AdminHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-8">
      <p className="mb-3 text-xs tracking-[0.28em] text-dark/45 uppercase">{eyebrow}</p>
      <h1 className="text-48">{title}</h1>
    </header>
  )
}

function PanelTitle({ title }: { title: string }) {
  return <h2 className="mb-5 text-xl font-semibold tracking-normal">{title}</h2>
}

function TextInput({
  label,
  value,
  onChange,
  name,
  type = "text",
  required,
  autoComplete,
  minLength,
}: {
  label: string
  value?: string
  onChange?: (value: string) => void
  name?: string
  type?: string
  required?: boolean
  autoComplete?: string
  minLength?: number
}) {
  const id = `admin-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <label htmlFor={id} className="mb-5 block">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <input
        id={id}
        name={name}
        aria-label={label}
        type={type}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm transition-colors outline-none focus:border-dark/45"
      />
    </label>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <TextInput
      label={label}
      type="number"
      value={String(value)}
      onChange={(next) => onChange(Math.max(0, Number(next) || 0))}
    />
  )
}

function SelectInput<TValue extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: TValue
  onChange: (value: TValue) => void
  options: Array<{ value: TValue; label: string }>
}) {
  const id = `admin-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <label htmlFor={id} className="mb-5 block">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as TValue)}
        className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm transition-colors outline-none focus:border-dark/45"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = `admin-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <label htmlFor={id} className="mb-5 block">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="admin-color-input h-[46px] w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg border-0 bg-transparent p-0"
        />
        <input
          type="text"
          aria-label={`${label} hex`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm transition-colors outline-none focus:border-dark/45"
        />
      </div>
    </label>
  )
}

// A coloured on/off switch: green when active, grey when off.
function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-dark/20",
      )}
    >
      <span
        className={clsx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  )
}

function SwitchInput({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-dark/10 px-4 py-3">
      <div>
        <span className="text-sm font-medium">{label}</span>
        {description && <p className="mt-0.5 text-xs text-dark/45">{description}</p>}
      </div>
      <ToggleSwitch label={label} checked={checked} onChange={onChange} />
    </div>
  )
}

// Multi-select checkbox row, e.g. pop-up page targeting.
function CheckboxGroup<TValue extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: Array<{ value: TValue; label: string }>
  selected: TValue[]
  onToggle: (value: TValue) => void
}) {
  return (
    <div className="mb-5">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option.value)}
              className={clsx(
                "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-dark bg-dark text-white"
                  : "border-dark/15 text-dark/65 hover:border-dark/40",
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Centered modal for editing an existing item. Rendered above everything
// (z-[3000]); click the backdrop or the × to close.
function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center overflow-y-auto bg-dark/40 p-4 backdrop-blur-sm md:p-10">
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
      />
      <div className="relative z-10 my-auto w-full max-w-2xl rounded-xl border border-dark/10 bg-canvas p-6 shadow-2xl md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {eyebrow && (
              <p className="mb-1 text-xs tracking-[0.28em] text-dark/45 uppercase">{eyebrow}</p>
            )}
            <h2 className="text-2xl font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close editor"
            onClick={onClose}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-dark/15 text-xl leading-none text-dark/60 transition-colors hover:bg-dark/5"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
