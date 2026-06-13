import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { Navbar } from "../../components/ui/navbar"

type AuthMode = "signIn" | "signUp"
type AdminSection = "about" | "global" | "marketing" | "inquiries"
type AnnouncementScope = "off" | "home" | "all"
type PopupFrequency = "everyVisit" | "oncePerSession" | "oncePerDay"

const SECTIONS: Array<{ key: AdminSection; label: string }> = [
  { key: "about", label: "About Page" },
  { key: "global", label: "Footer / Global" },
  { key: "marketing", label: "Marketing" },
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
  isActive: false,
  imageUrl: "",
  heading: "",
  text: "",
  buttonLabel: "",
  buttonLink: "",
  emailCaptureEnabled: true,
  delaySeconds: 3,
  frequency: "oncePerSession" as PopupFrequency,
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
  const [section, setSection] = useState<AdminSection>("marketing")

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-dark/10 bg-light/60 px-5 py-6 backdrop-blur md:w-80">
        <button type="button" className="mb-10 text-left" onClick={() => setSection("marketing")}>
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
          {section === "about" && <Placeholder title="About Page" />}
          {section === "global" && <Placeholder title="Footer / Global" />}
          {section === "marketing" && <MarketingPanel />}
          {section === "inquiries" && <InquiriesPanel />}
        </div>
      </section>
    </div>
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

function MarketingPanel() {
  const announcements = useQuery(api.marketing.listAnnouncements)
  const popup = useQuery(api.marketing.getPopupForAdmin)
  const saveAnnouncement = useMutation(api.marketing.saveAnnouncement)
  const activateAnnouncement = useMutation(api.marketing.activateAnnouncement)
  const savePopup = useMutation(api.marketing.savePopup)
  const [announcementForm, setAnnouncementForm] = useState(blankAnnouncement)
  const [popupForm, setPopupForm] = useState(blankPopup)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (popup) {
      setPopupForm({
        isActive: popup.isActive,
        imageUrl: popup.imageUrl,
        heading: popup.heading,
        text: popup.text,
        buttonLabel: popup.buttonLabel,
        buttonLink: popup.buttonLink,
        emailCaptureEnabled: popup.emailCaptureEnabled,
        delaySeconds: popup.delaySeconds,
        frequency: popup.frequency,
      })
    }
  }, [popup])

  const submitAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await saveAnnouncement({
      ...announcementForm,
      buttonLabel: announcementForm.buttonLabel || undefined,
      buttonLink: announcementForm.buttonLink || undefined,
    })
    setAnnouncementForm(blankAnnouncement)
    setMessage("Announcement saved.")
  }

  const submitPopup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await savePopup(popupForm)
    setMessage("Popup saved.")
  }

  return (
    <section className="space-y-8">
      <AdminHeader title="Marketing" eyebrow="Announcement bar and home popup" />
      {message && <p className="rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>}

      <div className="grid gap-8 xl:grid-cols-[1fr_0.9fr]">
        <form onSubmit={(event) => void submitAnnouncement(event)} className="admin-card">
          <PanelTitle title="Announcement bar" />
          <TextInput
            label="Internal title"
            value={announcementForm.title}
            onChange={(title) => setAnnouncementForm((prev) => ({ ...prev, title }))}
            required
          />
          <TextInput
            label="Announcement text"
            value={announcementForm.text}
            onChange={(text) => setAnnouncementForm((prev) => ({ ...prev, text }))}
            required
          />
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Button label"
              value={announcementForm.buttonLabel}
              onChange={(buttonLabel) =>
                setAnnouncementForm((prev) => ({ ...prev, buttonLabel }))
              }
            />
            <TextInput
              label="Button link"
              value={announcementForm.buttonLink}
              onChange={(buttonLink) => setAnnouncementForm((prev) => ({ ...prev, buttonLink }))}
            />
            <TextInput
              label="Background color"
              value={announcementForm.backgroundColor}
              onChange={(backgroundColor) =>
                setAnnouncementForm((prev) => ({ ...prev, backgroundColor }))
              }
            />
            <TextInput
              label="Text color"
              value={announcementForm.textColor}
              onChange={(textColor) => setAnnouncementForm((prev) => ({ ...prev, textColor }))}
            />
          </div>
          <SelectInput
            label="Display"
            value={announcementForm.scope}
            onChange={(scope) => setAnnouncementForm((prev) => ({ ...prev, scope }))}
            options={[
              { value: "home", label: "Home page only" },
              { value: "all", label: "Every page" },
              { value: "off", label: "Off" },
            ]}
          />
          <ToggleInput
            label="Make this the active announcement"
            checked={announcementForm.isActive}
            onChange={(isActive) => setAnnouncementForm((prev) => ({ ...prev, isActive }))}
          />
          <button type="submit" className="admin-primary">
            {announcementForm.id ? "Update announcement" : "Create announcement"}
          </button>
        </form>

        <div className="admin-card">
          <PanelTitle title="Saved announcements" />
          <div className="space-y-3">
            {announcements === undefined && <p className="text-sm text-dark/55">Loading...</p>}
            {announcements?.length === 0 && (
              <p className="text-sm text-dark/55">No announcements yet.</p>
            )}
            {announcements?.map((announcement) => (
              <div key={announcement._id} className="rounded-lg border border-dark/10 p-4">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{announcement.title}</p>
                    <p className="mt-1 text-sm text-dark/55">{announcement.text}</p>
                  </div>
                  <span className="rounded-full bg-dark/5 px-3 py-1 text-xs text-dark/60">
                    {announcement.isActive ? announcement.scope : "inactive"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() =>
                      setAnnouncementForm({
                        id: announcement._id,
                        title: announcement.title,
                        text: announcement.text,
                        buttonLabel: announcement.buttonLabel ?? "",
                        buttonLink: announcement.buttonLink ?? "",
                        backgroundColor: announcement.backgroundColor,
                        textColor: announcement.textColor,
                        scope: announcement.scope,
                        isActive: announcement.isActive,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() =>
                      void activateAnnouncement({
                        id: announcement._id,
                        scope: announcement.scope === "off" ? "home" : announcement.scope,
                      })
                    }
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => void activateAnnouncement({ id: announcement._id, scope: "off" })}
                  >
                    Turn off
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={(event) => void submitPopup(event)} className="admin-card">
        <PanelTitle title="Home popup" />
        <div className="grid gap-5 lg:grid-cols-2">
          <TextInput
            label="Image URL"
            value={popupForm.imageUrl}
            onChange={(imageUrl) => setPopupForm((prev) => ({ ...prev, imageUrl }))}
          />
          <TextInput
            label="Heading"
            value={popupForm.heading}
            onChange={(heading) => setPopupForm((prev) => ({ ...prev, heading }))}
          />
          <TextInput
            label="Text"
            value={popupForm.text}
            onChange={(text) => setPopupForm((prev) => ({ ...prev, text }))}
          />
          <TextInput
            label="Button label"
            value={popupForm.buttonLabel}
            onChange={(buttonLabel) => setPopupForm((prev) => ({ ...prev, buttonLabel }))}
          />
          <TextInput
            label="Button link"
            value={popupForm.buttonLink}
            onChange={(buttonLink) => setPopupForm((prev) => ({ ...prev, buttonLink }))}
          />
          <NumberInput
            label="Show after seconds"
            value={popupForm.delaySeconds}
            onChange={(delaySeconds) => setPopupForm((prev) => ({ ...prev, delaySeconds }))}
          />
          <SelectInput
            label="Display frequency"
            value={popupForm.frequency}
            onChange={(frequency) => setPopupForm((prev) => ({ ...prev, frequency }))}
            options={[
              { value: "everyVisit", label: "Every visit" },
              { value: "oncePerSession", label: "Once per session" },
              { value: "oncePerDay", label: "Once per day" },
            ]}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleInput
            label="Popup active"
            checked={popupForm.isActive}
            onChange={(isActive) => setPopupForm((prev) => ({ ...prev, isActive }))}
          />
          <ToggleInput
            label="Email capture enabled"
            checked={popupForm.emailCaptureEnabled}
            onChange={(emailCaptureEnabled) =>
              setPopupForm((prev) => ({ ...prev, emailCaptureEnabled }))
            }
          />
        </div>
        <button type="submit" className="admin-primary">
          Save popup
        </button>
      </form>
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

function ToggleInput({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="mb-5 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-dark/10 px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-dark"
      />
    </label>
  )
}
