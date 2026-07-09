import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react"
import { ArrowLeft } from "@phosphor-icons/react/ArrowLeft"
import { ArrowsClockwise } from "@phosphor-icons/react/ArrowsClockwise"
import { CaretDown } from "@phosphor-icons/react/CaretDown"
import { SignOut } from "@phosphor-icons/react/SignOut"
import { Storefront } from "@phosphor-icons/react/Storefront"
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
import {
  AboutPageEditor,
  ContactPageEditor,
  GlobalPageEditor,
  type PageEditorSaveRef,
} from "../../components/admin/page-editors"
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
type StaticAdminSection =
  | "dashboard"
  | "analytics"
  | "announcements"
  | "popups"
  | "pageAbout"
  | "pageContact"
  | "pageGlobal"
  | "inquiries"
type CollectionSection = `collection:${string}`
type AdminSection = StaticAdminSection | CollectionSection
type AnnouncementScope = "home" | "all"

type PopupMediaItem = { type: PopupMediaType; storageId: Id<"_storage">; url: string | null }

type NavItem = { key: AdminSection; label: string }
type NavEntry = { kind: "item"; item: NavItem } | { kind: "group"; label: string; items: NavItem[] }
type CollectionImageForm = { storageId: Id<"_storage"> | null; url: string | null }
type CollectionSpecForm = { label: string; value: string }

const COLLECTIONS_NAV_LABEL = "Collections"
const COLLECTION_SECTION_PREFIX = "collection:"
const COLLECTIONS_NAV_ARGS = {
  paginationOpts: { numItems: 250, cursor: null as string | null },
}
const COLLECTION_IMAGE_SLOTS = [
  { label: "Hero image", ratio: "4:5", aspectRatio: "4 / 5" },
  { label: "Spec image", ratio: "16:9", aspectRatio: "16 / 9" },
  { label: "Full-bleed image", ratio: "1:1", aspectRatio: "1 / 1" },
  { label: "Framed image", ratio: "4:5", aspectRatio: "4 / 5" },
] as const

// Dark green highlight for the currently-selected pill (time range, analytics
// sub-tab, inquiry tab). The active *sidebar* item stays black (see NavButton).
const ACTIVE_PILL = "border-[#15803d] bg-[#15803d] text-white"

// Sidebar layout: Dashboard, then Analytics, then the dropdown groups, then the rest.
const NAV: NavEntry[] = [
  { kind: "item", item: { key: "dashboard", label: "Dashboard" } },
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
    label: COLLECTIONS_NAV_LABEL,
    items: [],
  },
  {
    kind: "group",
    label: "Page Editor",
    items: [
      { key: "pageAbout", label: "About" },
      { key: "pageContact", label: "Contact" },
      { key: "pageGlobal", label: "Global / Footer" },
    ],
  },
  { kind: "item", item: { key: "inquiries", label: "Inquiries" } },
]

function collectionSection(handle: string): CollectionSection {
  return `${COLLECTION_SECTION_PREFIX}${handle}`
}

function isCollectionSection(section: AdminSection): section is CollectionSection {
  return section.startsWith(COLLECTION_SECTION_PREFIX)
}

function collectionHandleFromSection(section: CollectionSection) {
  return section.slice(COLLECTION_SECTION_PREFIX.length)
}

// Which group (if any) owns a section — used to auto-expand the right dropdown.
function groupOf(section: AdminSection, entries: NavEntry[] = NAV): string | null {
  for (const entry of entries) {
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
          <Dashboard onSignOut={() => void signOut()} />
        )
      ) : (
        <CenteredShell>
          <div className="mb-10">
            <p className="mb-3 text-xs tracking-[0.28em] text-dark/55 uppercase">
              Stryk Studios admin
            </p>
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

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [section, setSection] = useState<AdminSection>("dashboard")
  const [pageDirty, setPageDirty] = useState(false)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const pageSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const pendingNavigationRef = useRef<(() => void) | null>(null)
  // Expanded dropdown groups. Start with the group owning the active section
  // open so its item is visible.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    const owner = groupOf("dashboard")
    if (owner) initial.add(owner)
    return initial
  })
  const catalogSync = useCatalogSync()
  const collections = useQuery(api.catalog.listCollections, COLLECTIONS_NAV_ARGS)
  const collectionItems = useMemo<NavItem[]>(
    () =>
      (collections?.page ?? []).map((collection) => ({
        key: collectionSection(collection.shopifyHandle),
        label: collection.title,
      })),
    [collections],
  )
  const navEntries = useMemo<NavEntry[]>(
    () =>
      NAV.map((entry) =>
        entry.kind === "group" && entry.label === COLLECTIONS_NAV_LABEL
          ? { ...entry, items: collectionItems }
          : entry,
      ),
    [collectionItems],
  )
  const selectedCollection =
    isCollectionSection(section) && collections?.page
      ? collections.page.find(
          (collection) => collectionSection(collection.shopifyHandle) === section,
        )
      : null

  const requestNavigation = (action: () => void) => {
    if (!pageDirty) {
      action()
      return
    }
    pendingNavigationRef.current = action
    setShowLeaveDialog(true)
  }

  const go = (next: AdminSection) => {
    if (next === section) return
    requestNavigation(() => {
      pageSaveRef.current = null
      setPageDirty(false)
      setSection(next)
      const owner = groupOf(next, navEntries)
      if (owner) setExpanded((prev) => new Set(prev).add(owner))
    })
  }

  const toggleGroup = (label: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })

  useEffect(() => {
    if (!pageDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [pageDirty])

  const signOut = () => {
    requestNavigation(onSignOut)
  }

  const leaveWithoutSaving = () => {
    setShowLeaveDialog(false)
    const action = pendingNavigationRef.current
    pendingNavigationRef.current = null
    action?.()
  }

  const saveAndContinue = async () => {
    const saved = await pageSaveRef.current?.()
    if (saved) leaveWithoutSaving()
    else setShowLeaveDialog(false)
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-dark/10 bg-light/60 px-5 py-6 backdrop-blur md:w-80">
        <nav className="mt-16 flex flex-1 flex-col gap-1 overflow-y-auto">
          {navEntries.map((entry) =>
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
                  className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm font-medium text-dark/65 transition-colors hover:bg-dark/5"
                >
                  {entry.label}
                  <CaretDown
                    aria-hidden="true"
                    size={14}
                    weight="bold"
                    className={clsx(
                      "transition-transform",
                      expanded.has(entry.label) && "rotate-180",
                    )}
                  />
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
                    {entry.label === COLLECTIONS_NAV_LABEL &&
                      collections === undefined &&
                      entry.items.length === 0 && (
                        <p className="px-4 py-2 text-sm text-dark/40">Loading...</p>
                      )}
                    {entry.label === COLLECTIONS_NAV_LABEL &&
                      collections !== undefined &&
                      entry.items.length === 0 && (
                        <p className="px-4 py-2 text-sm text-dark/40">No collections</p>
                      )}
                  </div>
                )}
              </div>
            ),
          )}
        </nav>
        <div className="mt-6 border-t border-dark/10 pt-5">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void catalogSync.runSync()}
              disabled={catalogSync.isSyncing}
              className="admin-primary w-full gap-2"
            >
              <ArrowsClockwise
                aria-hidden="true"
                size={16}
                weight="bold"
                className={clsx(catalogSync.isSyncing && "animate-spin")}
              />
              {catalogSync.isSyncing ? "Syncing..." : "Sync catalog"}
            </button>
            <a
              href="https://admin.shopify.com/store/stryk-8562"
              target="_blank"
              rel="noreferrer"
              className="admin-secondary w-full gap-2"
            >
              <Storefront aria-hidden="true" size={16} weight="bold" />
              Shopify store
            </a>
            <Link
              to="/"
              onClick={(event) => {
                if (!pageDirty) return
                event.preventDefault()
                requestNavigation(() => window.location.assign("/"))
              }}
              className="admin-secondary w-full gap-2"
            >
              <ArrowLeft aria-hidden="true" size={16} weight="bold" />
              Back to site
            </Link>
            <button type="button" onClick={signOut} className="admin-secondary w-full gap-2">
              <SignOut aria-hidden="true" size={16} weight="bold" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
      <section className="min-h-screen flex-1 pl-72 md:pl-80">
        <div className="mx-auto w-full max-w-7xl px-8 py-10">
          {/* Keyed by section so switching tabs clears a previously caught
              error and retries the panel. Without this, a throw in one panel
              (e.g. a failing Convex query) would unmount the whole dashboard. */}
          <ErrorBoundary key={section} fallback={(error) => <PanelError error={error} />}>
            {section === "dashboard" && <DashboardPanel onNavigate={go} />}
            {section === "analytics" && <AnalyticsPanel />}
            {section === "announcements" && <AnnouncementsPanel />}
            {section === "popups" && <PopupsPanel />}
            {isCollectionSection(section) && (
              <CollectionAdminPanel
                collectionHandle={
                  selectedCollection?.shopifyHandle ?? collectionHandleFromSection(section)
                }
                title={selectedCollection?.title ?? "Collection"}
              />
            )}
            {section === "pageAbout" && (
              <AboutPageEditor
                onDirtyChange={setPageDirty}
                saveRef={pageSaveRef as PageEditorSaveRef}
              />
            )}
            {section === "pageContact" && (
              <ContactPageEditor
                onDirtyChange={setPageDirty}
                saveRef={pageSaveRef as PageEditorSaveRef}
              />
            )}
            {section === "pageGlobal" && (
              <GlobalPageEditor
                onDirtyChange={setPageDirty}
                saveRef={pageSaveRef as PageEditorSaveRef}
              />
            )}
            {section === "inquiries" && <InquiriesPanel />}
          </ErrorBoundary>
        </div>
      </section>
      {showLeaveDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/35 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-dark/10 bg-canvas p-7 shadow-2xl">
            <p className="mb-2 text-xs tracking-[0.22em] text-dark/45 uppercase">Unsaved changes</p>
            <h2 className="text-3xl">Leave this page?</h2>
            <p className="mt-3 text-sm leading-relaxed text-dark/60">
              Your latest edits have not been published. Save them before continuing or leave
              without saving.
            </p>
            <div className="mt-7 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setShowLeaveDialog(false)}
              >
                Stay
              </button>
              <button type="button" className="admin-secondary" onClick={leaveWithoutSaving}>
                Leave without saving
              </button>
              <button
                type="button"
                className="admin-primary"
                onClick={() => void saveAndContinue()}
              >
                Save and continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
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

function blankCollectionImages(): CollectionImageForm[] {
  return COLLECTION_IMAGE_SLOTS.map(() => ({ storageId: null, url: null }))
}

function blankCollectionSpecs(): CollectionSpecForm[] {
  return Array.from({ length: 3 }, () => ({ label: "", value: "" }))
}

function useCollectionImageUploader() {
  const generateUploadUrl = useMutation(api.catalog.generateCollectionImageUploadUrl)
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

function CollectionAdminPanel({
  collectionHandle,
  title,
}: {
  collectionHandle: string
  title: string
}) {
  const settings = useQuery(api.catalog.getCollectionPageSettingsForAdmin, { collectionHandle })
  const saveSettings = useMutation(api.catalog.saveCollectionPageSettings)
  const upload = useCollectionImageUploader()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState<CollectionImageForm[]>(() => blankCollectionImages())
  const [specs, setSpecs] = useState<CollectionSpecForm[]>(() => blankCollectionSpecs())
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings === undefined) return

    setImages(
      COLLECTION_IMAGE_SLOTS.map((_, index) => {
        const image = settings?.pageSettings?.heroImages[index]
        return { storageId: image?.storageId ?? null, url: image?.url ?? null }
      }),
    )
    setSpecs(settings?.pageSettings?.specs ?? blankCollectionSpecs())
    setMessage(null)
    setError(null)
  }, [settings])

  const openUploader = (slot: number) => {
    setActiveSlot(slot)
    fileInputRef.current?.click()
  }

  const handleUpload = async (files: FileList | null) => {
    if (activeSlot === null || !files?.[0]) return

    const slot = activeSlot
    setUploadingSlot(slot)
    setError(null)
    setMessage(null)

    try {
      const file = files[0]
      const storageId = await upload(file)
      const url = URL.createObjectURL(file)
      setImages((prev) => prev.map((image, index) => (index === slot ? { storageId, url } : image)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploadingSlot(null)
      setActiveSlot(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const save = async () => {
    const heroImages = images.map((image) => image.storageId)
    if (heroImages.some((storageId) => storageId === null)) {
      setError("Upload all four images before saving.")
      return
    }

    const cleanedSpecs = specs.map((spec) => ({
      label: spec.label.trim(),
      value: spec.value.trim(),
    }))
    if (cleanedSpecs.some((spec) => !spec.label || !spec.value)) {
      setError("Fill all three specification rows before saving.")
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      await saveSettings({
        collectionHandle,
        heroImages: heroImages as Id<"_storage">[],
        specs: cleanedSpecs,
      })
      setMessage("Saved.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.")
    } finally {
      setSaving(false)
    }
  }

  if (settings === undefined) {
    return (
      <section>
        <h1 className="text-48">{title}</h1>
        <p className="mt-8 text-sm text-dark/55">Loading...</p>
      </section>
    )
  }

  if (settings === null) {
    return (
      <section>
        <h1 className="text-48">{title}</h1>
        <p className="mt-8 text-sm text-dark/55">Collection not found.</p>
      </section>
    )
  }

  return (
    <section className="space-y-8">
      <h1 className="text-48">{title}</h1>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="admin-card">
          <PanelTitle title="Images" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {COLLECTION_IMAGE_SLOTS.map((slot, index) => {
              const image = images[index]
              const isUploading = uploadingSlot === index
              return (
                <div
                  key={slot.label}
                  className="flex h-full flex-col rounded-lg border border-dark/10 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-dark">{slot.label}</p>
                    <span className="rounded-full bg-dark/5 px-2.5 py-1 text-xs text-dark/45">
                      {slot.ratio}
                    </span>
                  </div>
                  <div
                    className="mx-auto flex w-full max-w-52 items-center justify-center overflow-hidden rounded-lg border border-dark/15 bg-canvas"
                    style={{ aspectRatio: slot.aspectRatio }}
                  >
                    {image?.url ? (
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm text-dark/40">
                        {isUploading ? "Uploading..." : "No image"}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      className="admin-secondary w-full py-2"
                      disabled={uploadingSlot !== null}
                      onClick={() => openUploader(index)}
                    >
                      {image?.url ? "Replace" : "Upload"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload collection image"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />
        </div>

        <div className="admin-card">
          <PanelTitle title="Specifications" />
          <div className="space-y-2">
            {specs.map((spec, index) => (
              <div key={index} className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label={`Label ${index + 1}`}
                  value={spec.label}
                  onChange={(label) =>
                    setSpecs((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label } : item,
                      ),
                    )
                  }
                  required
                />
                <TextInput
                  label={`Value ${index + 1}`}
                  value={spec.value}
                  onChange={(value) =>
                    setSpecs((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value } : item,
                      ),
                    )
                  }
                  required
                />
              </div>
            ))}
          </div>
        </div>

        {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}
        {error && (
          <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        <button type="submit" className="admin-primary" disabled={saving || uploadingSlot !== null}>
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </section>
  )
}

function useCatalogSync() {
  const syncCatalogPage = useAction(api.shopify.syncCatalogPageForAdmin)
  const finalizeCatalogSync = useAction(api.shopify.finalizeCatalogSyncForAdmin)
  const [isSyncing, setIsSyncing] = useState(false)

  const runSync = useCallback(async () => {
    setIsSyncing(true)

    try {
      let after: string | undefined
      let hasNextPage = true
      let syncStartedAt: number | undefined

      while (hasNextPage) {
        // eslint-disable-next-line no-await-in-loop
        const result = await syncCatalogPage({ first: 25, after, syncStartedAt })
        syncStartedAt = result.syncStartedAt
        hasNextPage = result.hasNextPage && !!result.nextCursor
        after = result.nextCursor ?? undefined
      }

      if (syncStartedAt === undefined) throw new Error("Shopify sync did not start.")
      await finalizeCatalogSync({ syncStartedAt })
    } catch (err) {
      console.error(err)
    } finally {
      setIsSyncing(false)
    }
  }, [syncCatalogPage, finalizeCatalogSync])

  return { runSync, isSyncing }
}

type AnalyticsView = "general" | "marketing" | "products"

const ANALYTICS_VIEWS: Array<{ key: AnalyticsView; label: string }> = [
  { key: "general", label: "General" },
  { key: "marketing", label: "Marketing" },
  { key: "products", label: "Products" },
]

function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`
}

function formatCurrency(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currencyCode}`
  }
}

// Shown above sampled figures when a window held more events than the scan cap.
function SampleNote() {
  return (
    <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
      This range has a very high number of events — figures below are a sample of the most recent
      activity. Pick a shorter range for exact counts.
    </p>
  )
}

function AnalyticsPanel() {
  const [view, setView] = useState<AnalyticsView>("general")
  const [range, setRange] = useState<RangeKey>("1w")
  const [now, setNow] = useState(() => Date.now())
  // Re-anchor "now" whenever the range changes so switching tabs refreshes the
  // window (and buckets) to the current moment.
  const built = useMemo(() => buildRange(range, now), [range, now])
  const selectRange = (nextRange: RangeKey) => {
    setRange(nextRange)
    setNow(Date.now())
  }

  return (
    <section className="space-y-8">
      <AdminHeader title="Analytics" eyebrow="Traffic, conversion & paths" />

      {/* General / Marketing / Products */}
      <div className="inline-flex rounded-full border border-dark/15 p-1">
        {ANALYTICS_VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              view === item.key ? "bg-[#15803d] text-white" : "text-dark/60 hover:bg-dark/5",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Time-range selector — shared by all three views */}
      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => selectRange(option.key)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              range === option.key
                ? ACTIVE_PILL
                : "border-dark/15 text-dark/65 hover:border-dark/35",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "general" && <GeneralAnalytics built={built} />}
      {view === "marketing" && <MarketingAnalytics since={built.since} until={built.until} />}
      {view === "products" && <ProductsAnalytics since={built.since} until={built.until} />}
    </section>
  )
}

function GeneralAnalytics({ built }: { built: ReturnType<typeof buildRange> }) {
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

  if (data === undefined) {
    return <p className="text-sm text-dark/55">Loading analytics...</p>
  }

  return (
    <>
      {data.truncated && <SampleNote />}

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
  )
}

// Rows for the Marketing tab's pop-up / announcement performance tables.
type MarketingRow = { id: string; title: string; views: number; clicks: number; ctr: number }

function MarketingTable({
  rows,
  showSignups,
  emptyLabel,
}: {
  rows: Array<MarketingRow & { signups?: number }>
  showSignups?: boolean
  emptyLabel: string
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-dark/40">
        {emptyLabel}
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs tracking-[0.12em] text-dark/45 uppercase">
            <th className="pb-3 font-semibold">Title</th>
            <th className="pb-3 text-right font-semibold">Views</th>
            <th className="pb-3 text-right font-semibold">Clicks</th>
            {showSignups && <th className="pb-3 text-right font-semibold">Sign-ups</th>}
            <th className="pb-3 text-right font-semibold">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dark/10">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="max-w-[18rem] truncate py-3 pr-4 text-dark/80" title={row.title}>
                {row.title}
              </td>
              <td className="py-3 text-right font-medium text-dark tabular-nums">
                {row.views.toLocaleString()}
              </td>
              <td className="py-3 text-right font-medium text-dark tabular-nums">
                {row.clicks.toLocaleString()}
              </td>
              {showSignups && (
                <td className="py-3 text-right font-medium text-dark tabular-nums">
                  {(row.signups ?? 0).toLocaleString()}
                </td>
              )}
              <td className="py-3 text-right text-dark/60 tabular-nums">{formatPct(row.ctr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MarketingAnalytics({ since, until }: { since: number; until: number }) {
  const data = useQuery(api.analytics.getMarketingOverview, { since, until })
  if (data === undefined) {
    return <p className="text-sm text-dark/55">Loading marketing analytics...</p>
  }
  const t = data.totals
  return (
    <>
      {data.truncated && <SampleNote />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Pop-up Views" value={t.popupViews.toLocaleString()} />
        <StatCard label="Pop-up Clicks" value={t.popupClicks.toLocaleString()} />
        <StatCard label="Email Sign-ups" value={t.signups.toLocaleString()} />
        <StatCard label="Bar Views" value={t.announcementViews.toLocaleString()} />
        <StatCard label="Bar Clicks" value={t.announcementClicks.toLocaleString()} />
      </div>

      <ChartCard title="Pop-up Performance">
        <MarketingTable
          rows={data.popups}
          showSignups
          emptyLabel="No pop-up activity in this range yet."
        />
      </ChartCard>

      <ChartCard title="Announcement Bar Performance">
        <MarketingTable
          rows={data.announcements}
          emptyLabel="No announcement bar activity in this range yet."
        />
      </ChartCard>

      <p className="text-xs text-dark/45">
        Views count each time a pop-up or bar was shown; clicks count its button. Tracking began
        when this feature shipped, so history before then isn&apos;t included.
      </p>
    </>
  )
}

function ProductsAnalytics({ since, until }: { since: number; until: number }) {
  const data = useQuery(api.analytics.getProductsOverview, { since, until })
  if (data === undefined) {
    return <p className="text-sm text-dark/55">Loading product analytics...</p>
  }
  return (
    <>
      {data.truncated && <SampleNote />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Est. Revenue"
          value={formatCurrency(data.totalEstRevenue, data.currencyCode)}
          sub="estimated — not actual sales"
        />
        <StatCard label="Products Ranked" value={data.revenue.length.toLocaleString()} />
        <StatCard label="Collections Viewed" value={data.topCollections.length.toLocaleString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Most Viewed Products">
          <HBars items={data.topProducts} emptyLabel="No product views in this range yet." />
        </ChartCard>
        <ChartCard title="Most Viewed Collections">
          <HBars items={data.topCollections} emptyLabel="No collection views in this range yet." />
        </ChartCard>
      </div>

      <ChartCard title="Estimated Revenue by Product">
        {data.revenue.length === 0 ? (
          <div className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-dark/40">
            No add-to-cart activity in this range yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-[0.12em] text-dark/45 uppercase">
                  <th className="pb-3 font-semibold">Product</th>
                  <th className="pb-3 text-right font-semibold">Add-to-carts</th>
                  <th className="pb-3 text-right font-semibold">Est. revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark/10">
                {data.revenue.map((row) => (
                  <tr key={row.label}>
                    <td className="max-w-[18rem] truncate py-3 pr-4 text-dark/80" title={row.label}>
                      {row.label}
                    </td>
                    <td className="py-3 text-right font-medium text-dark tabular-nums">
                      {row.units.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-medium text-dark tabular-nums">
                      {row.estRevenue > 0 ? formatCurrency(row.estRevenue, data.currencyCode) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>

      <p className="text-xs text-dark/45">
        Revenue is <strong>estimated</strong> from add-to-cart events × each product&apos;s catalog
        price. Shopify only shares the catalog with this dashboard (no order data), so these figures
        are directional, not confirmed sales.
      </p>
    </>
  )
}

// Landing overview: quick traffic numbers, unhandled inquiries, fresh email
// captures, and shortcut buttons into the deeper panels.
function DashboardPanel({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const now = useMemo(() => Date.now(), [])
  const built = useMemo(() => buildRange("1w", now), [now])
  const data = useQuery(api.analytics.getDashboardSummary, {
    since: built.since,
    until: built.until,
  })

  const inquiries = data?.inquiries
  const captures = data?.emailCaptures
  const stats = data?.quickStats

  const quickActions: Array<{ label: string; section: AdminSection }> = [
    { label: "View inquiries", section: "inquiries" },
    { label: "Manage pop-ups", section: "popups" },
    { label: "Announcement bar", section: "announcements" },
    { label: "Full analytics", section: "analytics" },
  ]

  return (
    <section className="space-y-8">
      <AdminHeader title="Dashboard" eyebrow="Overview · last 7 days" />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Page Views"
          value={(stats?.pageViews ?? 0).toLocaleString()}
          sub="last 7 days"
        />
        <StatCard
          label="Visitors"
          value={(stats?.visitors ?? 0).toLocaleString()}
          sub="last 7 days"
        />
        <StatCard
          label="Pop-up Views"
          value={(stats?.popupViews ?? 0).toLocaleString()}
          sub="last 7 days"
        />
        <StatCard
          label="New Inquiries"
          value={inquiries ? `${inquiries.newCount}${inquiries.capped ? "+" : ""}` : "—"}
          sub="awaiting action"
        />
        <StatCard
          label="New Emails"
          value={(captures?.windowCount ?? 0).toLocaleString()}
          sub="last 7 days"
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => (
          <button
            key={action.section}
            type="button"
            className="admin-secondary"
            onClick={() => onNavigate(action.section)}
          >
            {action.label}
          </button>
        ))}
      </div>

      {data === undefined ? (
        <p className="text-sm text-dark/55">Loading overview...</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Unhandled inquiries */}
          <ChartCard title="Unhandled Inquiries">
            {inquiries && inquiries.recent.length > 0 ? (
              <>
                <div className="space-y-2.5">
                  {inquiries.recent.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-dark">
                          {item.name || item.email}
                        </p>
                        <p className="truncate text-xs text-dark/50">{item.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-dark/5 px-2.5 py-0.5 text-xs text-dark/55 uppercase">
                        {item.inquiryType}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="admin-secondary mt-4"
                  onClick={() => onNavigate("inquiries")}
                >
                  View all inquiries
                </button>
              </>
            ) : (
              <div className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-dark/40">
                No unhandled inquiries. You&apos;re all caught up.
              </div>
            )}
          </ChartCard>

          {/* Recent email captures */}
          <ChartCard title="Recent Email Captures">
            {captures && captures.recent.length > 0 ? (
              <>
                <div className="divide-y divide-dark/10">
                  {captures.recent.map((item, i) => (
                    <div
                      key={`${item.email}-${i}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-dark">{item.email}</span>
                      <span className="flex shrink-0 items-center gap-2 text-dark/45">
                        <span className="rounded-full bg-dark/5 px-2.5 py-0.5 text-xs">
                          {item.source}
                        </span>
                        {new Date(item.ts).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="admin-secondary mt-4"
                  onClick={() => onNavigate("inquiries")}
                >
                  View all captures
                </button>
              </>
            ) : (
              <div className="flex min-h-24 items-center justify-center py-6 text-center text-sm text-dark/40">
                No email captures yet.
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </section>
  )
}

// Per-item analytics modal, opened from a pop-up / announcement row. Shows
// all-time views, clicks, (pop-up) email sign-ups, and click-through rate.
function MarketingStatsModal({
  kind,
  id,
  title,
  onClose,
}: {
  kind: "popup" | "announcement"
  id: string
  title: string
  onClose: () => void
}) {
  const data = useQuery(api.analytics.getMarketingItemStats, { kind, id })
  return (
    <Modal
      title={title || (kind === "popup" ? "Pop-up" : "Announcement bar")}
      eyebrow={kind === "popup" ? "Pop-up analytics" : "Announcement analytics"}
      onClose={onClose}
    >
      {data === undefined ? (
        <p className="text-sm text-dark/55">Loading stats...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Views" value={data.views.toLocaleString()} />
            <StatCard label="Clicks" value={data.clicks.toLocaleString()} />
            {kind === "popup" && (
              <StatCard label="Email Sign-ups" value={(data.signups ?? 0).toLocaleString()} />
            )}
            <StatCard label="Click-through" value={formatPct(data.ctr)} />
          </div>
          <p className="mt-5 text-xs text-dark/45">
            Counted since analytics tracking was added
            {data.truncated ? " (showing a capped sample)" : ""}.
          </p>
        </>
      )}
    </Modal>
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
  // The announcement whose stats modal is open.
  const [statsFor, setStatsFor] = useState<{ id: string; title: string } | null>(null)

  const persist = async (form: AnnouncementForm) => {
    await saveAnnouncement({
      ...form,
      title: form.text.trim() || form.title,
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
            <div className="flex items-center gap-3">
              <ToggleSwitch
                label="Activate announcement bar"
                checked={announcement.isActive}
                onChange={(isActive) => void setActive({ id: announcement._id, isActive })}
              />
              <button
                type="button"
                className="admin-secondary"
                onClick={() =>
                  setStatsFor({
                    id: announcement._id,
                    title: announcement.title || announcement.text || "Announcement bar",
                  })
                }
              >
                Stats
              </button>
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
            onCancel={() => setEditing(null)}
            onSave={async (form) => {
              await persist(form)
              setEditing(null)
              setMessage(form.id ? "Announcement updated." : "Announcement created.")
            }}
          />
        </Modal>
      )}

      {statsFor && (
        <MarketingStatsModal
          kind="announcement"
          id={statsFor.id}
          title={statsFor.title}
          onClose={() => setStatsFor(null)}
        />
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
      className="flex min-h-11 items-center justify-center gap-4 rounded-lg px-5 py-3 text-center text-sm"
      style={{ backgroundColor, color: textColor }}
    >
      <span className="truncate">{text || "Announcement text"}</span>
      {buttonLabel && (
        <span className="shrink-0 underline underline-offset-4" style={{ color: textColor }}>
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
  onSave,
  onCancel,
}: {
  initial: AnnouncementForm
  submitLabel: string
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
          { value: "home", label: "Home" },
          { value: "all", label: "Every page" },
        ]}
      />
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
  // The pop-up whose stats modal is open.
  const [statsFor, setStatsFor] = useState<{ id: string; title: string } | null>(null)

  const persist = async (form: PopupForm) => {
    return await savePopup({
      id: form.id,
      title: form.heading.trim() || form.text.trim(),
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
                  {popup.heading || popup.text || "Untitled"}
                </p>
                <p className="mt-0.5 truncate text-sm text-dark/45">
                  {describePopupSummary(popup)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch
                label="Activate pop-up"
                checked={popup.isActive}
                onChange={(isActive) => void setActive({ id: popup._id, isActive })}
              />
              <button
                type="button"
                className="admin-secondary"
                onClick={() =>
                  setStatsFor({
                    id: popup._id,
                    title: popup.title || popup.heading || popup.text || "Pop-up",
                  })
                }
              >
                Stats
              </button>
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
            onCancel={() => setEditing(null)}
            onSave={async (form) => {
              await persist(form)
              setEditing(null)
              setMessage(form.id ? "Pop-up updated." : "Pop-up created.")
            }}
          />
        </Modal>
      )}

      {statsFor && (
        <MarketingStatsModal
          kind="popup"
          id={statsFor.id}
          title={statsFor.title}
          onClose={() => setStatsFor(null)}
        />
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
  onSave,
  onCancel,
}: {
  initial: PopupForm
  submitLabel: string
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
              tab === item.key ? "bg-[#15803d] text-white" : "text-dark/60 hover:bg-dark/5",
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
          className="admin-color-input h-[46px] w-12 flex-shrink-0 overflow-hidden rounded-lg border-0 bg-transparent p-0"
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
        "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:ring-loam/35 focus-visible:outline-none",
        checked ? "bg-loam" : "bg-dark/15",
      )}
    >
      <span
        className={clsx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
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
      <button type="button" aria-label="Close editor" onClick={onClose} className="fixed inset-0" />
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
