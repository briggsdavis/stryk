import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react"
import { clsx } from "clsx"
import { useMutation, useQuery } from "convex/react"
import { useCallback, useRef, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { ErrorBoundary } from "../../components/ui/error-boundary"
import { Navbar } from "../../components/ui/navbar"
import {
  MAX_POPUP_MEDIA,
  POPUP_FREQUENCY_OPTIONS,
  POPUP_POSITION_OPTIONS,
  type PopupFrequency,
  type PopupMediaType,
  type PopupPosition,
} from "../../lib/marketing"

type AuthMode = "signIn" | "signUp"
type AdminSection = "about" | "global" | "announcements" | "popups" | "inquiries"
type AnnouncementScope = "home" | "all"

type PopupMediaItem = { type: PopupMediaType; storageId: Id<"_storage">; url: string | null }

const SECTIONS: Array<{ key: AdminSection; label: string }> = [
  { key: "about", label: "About Page" },
  { key: "global", label: "Footer / Global" },
  { key: "announcements", label: "Announcement Bar" },
  { key: "popups", label: "Pop-ups" },
  { key: "inquiries", label: "Inquiries" },
]

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
  buttonLabel: "",
  buttonLink: "",
  emailCaptureEnabled: true,
  delaySeconds: 3,
  frequency: "oncePerSession" as PopupFrequency,
  isActive: false,
  position: "center" as PopupPosition,
  blurBackground: true,
  media: [] as PopupMediaItem[],
}

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
  const [section, setSection] = useState<AdminSection>("announcements")

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-dark/10 bg-light/60 px-5 py-6 backdrop-blur md:w-80">
        <button type="button" className="mb-10 text-left" onClick={() => setSection("announcements")}>
          <img src="/stryklogo.png" alt="Stryk" className="h-7 w-auto" />
        </button>
        <nav className="flex flex-1 flex-col gap-2">
          {SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSection(item.key)}
              className={`rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                section === item.key ? "bg-dark text-white" : "text-dark/65 hover:bg-dark/5"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-dark/10 pt-5">
          <p className="mb-3 break-words text-xs text-dark/50">{email}</p>
          <button type="button" onClick={onSignOut} className="admin-secondary w-full">
            Sign out
          </button>
        </div>
      </aside>
      <section className="min-h-screen flex-1 pl-72 md:pl-80">
        <div className="mx-auto w-full max-w-6xl px-8 py-10">
          {/* Keyed by section so switching tabs clears a previously caught
              error and retries the panel. Without this, a throw in one panel
              (e.g. a failing Convex query) would unmount the whole dashboard. */}
          <ErrorBoundary key={section} fallback={(error) => <PanelError error={error} />}>
            {section === "about" && <Placeholder title="About Page" />}
            {section === "global" && <Placeholder title="Footer / Global" />}
            {section === "announcements" && <AnnouncementsPanel />}
            {section === "popups" && <PopupsPanel />}
            {section === "inquiries" && <InquiriesPanel />}
          </ErrorBoundary>
        </div>
      </section>
    </div>
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

function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <AdminHeader title={title} eyebrow="Coming next" />
      <div className="rounded-lg border border-dark/10 bg-light/45 p-8">
        <p className="text-sm text-dark/60">
          This dashboard section is reserved for future editing controls.
        </p>
      </div>
    </section>
  )
}

function AnnouncementsPanel() {
  const announcements = useQuery(api.marketing.listAnnouncements)
  const saveAnnouncement = useMutation(api.marketing.saveAnnouncement)
  const setActive = useMutation(api.marketing.setAnnouncementActive)
  const deleteAnnouncement = useMutation(api.marketing.deleteAnnouncement)
  const [form, setForm] = useState(blankAnnouncement)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await saveAnnouncement({
      ...form,
      buttonLabel: form.buttonLabel || undefined,
      buttonLink: form.buttonLink || undefined,
    })
    setForm(blankAnnouncement)
    setMessage("Announcement saved.")
  }

  return (
    <section className="space-y-8">
      <AdminHeader title="Announcement Bar" eyebrow="Site-wide banner" />
      {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}

      <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={(event) => void submit(event)} className="admin-card">
          <PanelTitle title={form.id ? "Edit announcement" : "New announcement"} />
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
          <SwitchInput
            label="Active"
            description="Only one announcement can be live at a time."
            checked={form.isActive}
            onChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
          />
          <div className="flex gap-2">
            <button type="submit" className="admin-primary">
              {form.id ? "Update announcement" : "Create announcement"}
            </button>
            {form.id && (
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setForm(blankAnnouncement)}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="admin-card">
          <PanelTitle title="Saved announcements" />
          <div className="space-y-3">
            {announcements === undefined && <p className="text-sm text-dark/55">Loading...</p>}
            {announcements?.length === 0 && (
              <p className="text-sm text-dark/55">No announcements yet.</p>
            )}
            {announcements?.map((announcement) => (
              <div
                key={announcement._id}
                className={clsx(
                  "rounded-lg border p-4 transition-colors",
                  announcement.isActive
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-dark/10",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{announcement.title}</p>
                    <p className="mt-1 text-sm text-dark/55">{announcement.text}</p>
                    <p className="mt-1 text-xs text-dark/40">
                      {announcement.scope === "home" ? "Home page only" : "Every page"}
                    </p>
                  </div>
                  <ToggleSwitch
                    label="Active"
                    checked={announcement.isActive}
                    onChange={(isActive) =>
                      void setActive({ id: announcement._id, isActive })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() =>
                      setForm({
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
                    className="admin-secondary"
                    onClick={() => void deleteAnnouncement({ id: announcement._id })}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
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

function PopupsPanel() {
  const popups = useQuery(api.marketing.listPopups)
  const savePopup = useMutation(api.marketing.savePopup)
  const setActive = useMutation(api.marketing.setPopupActive)
  const deletePopup = useMutation(api.marketing.deletePopup)
  const upload = useMediaUploader()
  const [form, setForm] = useState(blankPopup)
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await savePopup({
      id: form.id,
      title: form.title,
      heading: form.heading,
      text: form.text,
      buttonLabel: form.buttonLabel,
      buttonLink: form.buttonLink,
      emailCaptureEnabled: form.emailCaptureEnabled,
      delaySeconds: form.delaySeconds,
      frequency: form.frequency,
      isActive: form.isActive,
      position: form.position,
      blurBackground: form.blurBackground,
      media: form.media.map(({ type, storageId }) => ({ type, storageId })),
    })
    setForm(blankPopup)
    setMessage("Pop-up saved.")
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

  return (
    <section className="space-y-8">
      <AdminHeader title="Pop-ups" eyebrow="Saved pop-ups and slide-ins" />
      {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}

      <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={(event) => void submit(event)} className="admin-card">
          <PanelTitle title={form.id ? "Edit pop-up" : "New pop-up"} />

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
            <SelectInput
              label="Position"
              value={form.position}
              onChange={(position) => setForm((prev) => ({ ...prev, position }))}
              options={POPUP_POSITION_OPTIONS}
            />
            <NumberInput
              label="Show after seconds"
              value={form.delaySeconds}
              onChange={(delaySeconds) => setForm((prev) => ({ ...prev, delaySeconds }))}
            />
            <SelectInput
              label="Display frequency"
              value={form.frequency}
              onChange={(frequency) => setForm((prev) => ({ ...prev, frequency }))}
              options={POPUP_FREQUENCY_OPTIONS}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SwitchInput
              label="Active"
              checked={form.isActive}
              onChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))}
            />
            <SwitchInput
              label="Email capture"
              checked={form.emailCaptureEnabled}
              onChange={(emailCaptureEnabled) =>
                setForm((prev) => ({ ...prev, emailCaptureEnabled }))
              }
            />
            <SwitchInput
              label="Blur / dim the page behind"
              checked={form.blurBackground}
              onChange={(blurBackground) => setForm((prev) => ({ ...prev, blurBackground }))}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="admin-primary" disabled={uploading}>
              {form.id ? "Update pop-up" : "Create pop-up"}
            </button>
            {form.id && (
              <button type="button" className="admin-secondary" onClick={() => setForm(blankPopup)}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="admin-card">
          <PanelTitle title="Saved pop-ups" />
          <div className="space-y-3">
            {popups === undefined && <p className="text-sm text-dark/55">Loading...</p>}
            {popups?.length === 0 && <p className="text-sm text-dark/55">No pop-ups yet.</p>}
            {popups?.map((popup) => (
              <div
                key={popup._id}
                className={clsx(
                  "rounded-lg border p-4 transition-colors",
                  popup.isActive ? "border-emerald-500/40 bg-emerald-500/5" : "border-dark/10",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {popup.media[0] &&
                      (popup.media[0].type === "video" ? (
                        <video
                          src={popup.media[0].url ?? undefined}
                          aria-label="Video thumbnail"
                          muted
                          className="h-12 w-12 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <img
                          src={popup.media[0].url ?? undefined}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded object-cover"
                        />
                      ))}
                    <div>
                      <p className="font-medium">{popup.title || popup.heading || "Untitled"}</p>
                      <p className="mt-1 text-xs text-dark/40">
                        {popup.position} · {popup.media.length} slide
                        {popup.media.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <ToggleSwitch
                    label="Active"
                    checked={popup.isActive}
                    onChange={(isActive) => void setActive({ id: popup._id, isActive })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() =>
                      setForm({
                        id: popup._id,
                        title: popup.title,
                        heading: popup.heading,
                        text: popup.text,
                        buttonLabel: popup.buttonLabel,
                        buttonLink: popup.buttonLink,
                        emailCaptureEnabled: popup.emailCaptureEnabled,
                        delaySeconds: popup.delaySeconds,
                        frequency: popup.frequency,
                        isActive: popup.isActive,
                        position: popup.position,
                        blurBackground: popup.blurBackground,
                        media: popup.media.map((m) => ({
                          type: m.type,
                          storageId: m.storageId,
                          url: m.url,
                        })),
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => void deletePopup({ id: popup._id })}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function InquiriesPanel() {
  const contactInquiries = useQuery(api.inquiries.listContactInquiries)
  const popupEmails = useQuery(api.inquiries.listPopupEmailCaptures)

  return (
    <section className="space-y-8">
      <AdminHeader title="Inquiries" eyebrow="Contact form and popup captures" />
      <div className="admin-card">
        <PanelTitle title="Contact form submissions" />
        <div className="space-y-3">
          {contactInquiries === undefined && <p className="text-sm text-dark/55">Loading...</p>}
          {contactInquiries?.length === 0 && <p className="text-sm text-dark/55">No messages yet.</p>}
          {contactInquiries?.map((item) => (
            <article key={item._id} className="rounded-lg border border-dark/10 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">
                  {item.firstName} {item.lastName}
                </p>
                <span className="rounded-full bg-dark/5 px-3 py-1 text-xs uppercase text-dark/55">
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
            </article>
          ))}
        </div>
      </div>
      <div className="admin-card">
        <PanelTitle title="Popup email captures" />
        <div className="divide-y divide-dark/10">
          {popupEmails === undefined && <p className="text-sm text-dark/55">Loading...</p>}
          {popupEmails?.length === 0 && <p className="text-sm text-dark/55">No emails yet.</p>}
          {popupEmails?.map((item) => (
            <div key={item._id} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
              <span>{item.email}</span>
              <span className="text-dark/45">
                {new Date(item._creationTime).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
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
        className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm outline-none transition-colors focus:border-dark/45"
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
        className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm outline-none transition-colors focus:border-dark/45"
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
          className="h-11 w-12 flex-shrink-0 cursor-pointer rounded-lg border border-dark/15 bg-canvas"
        />
        <input
          type="text"
          aria-label={`${label} hex`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm outline-none transition-colors focus:border-dark/45"
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
