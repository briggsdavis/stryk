import { useMutation, useQuery } from "convex/react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

type ImageSource = { url: string } | { storageId: Id<"_storage"> }
type EditorImage = { source: ImageSource; url: string }
type AccordionItem = { question: string; answer: string }
type AboutValue = { label: string; body: string; image: EditorImage }

type AboutForm = {
  eyebrow: string
  heading: string
  heroImage: EditorImage
  philosophyEyebrow: string
  philosophyBody: string
  philosophyMeta: string
  philosophyImages: EditorImage[]
  driversEyebrow: string
  visionLabel: string
  visionBody: string
  visionImage: EditorImage
  missionLabel: string
  missionBody: string
  missionImage: EditorImage
  storyEyebrow: string
  storyHeading: string
  storyBody: string
  storyHeroImage: EditorImage
  storyDetailImage: EditorImage
  valuesEyebrow: string
  values: AboutValue[]
  sustainabilityEyebrow: string
  sustainabilityHeading: string
  sustainabilityItems: AccordionItem[]
}

type ContactForm = {
  eyebrow: string
  heading: string
  studioName: string
  address: string
  faqHeading: string
  faqs: AccordionItem[]
}

type GlobalForm = { email: string; phone: string }

export type PageEditorSaveRef = { current: (() => Promise<boolean>) | null }
type EditorProps = {
  onDirtyChange: (dirty: boolean) => void
  saveRef: PageEditorSaveRef
}

function usePageImageUpload() {
  const generateUploadUrl = useMutation(api.pages.generateImageUploadUrl)
  return useCallback(
    async (file: File): Promise<EditorImage> => {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!response.ok) throw new Error("Image upload failed.")
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> }
      return { source: { storageId }, url: URL.createObjectURL(file) }
    },
    [generateUploadUrl],
  )
}

function useDirtyForm<T>(onDirtyChange: (dirty: boolean) => void) {
  const [form, setForm] = useState<T | null>(null)
  const setLoadedForm = useCallback(
    (value: T) => {
      setForm(value)
      onDirtyChange(false)
    },
    [onDirtyChange],
  )
  const updateForm: Dispatch<SetStateAction<T | null>> = useCallback(
    (next) => {
      setForm(next)
      onDirtyChange(true)
    },
    [onDirtyChange],
  )
  return { form, setLoadedForm, updateForm }
}

function requireContent(value: unknown, message: string) {
  if (typeof value === "string" && !value.trim()) throw new Error(message)
}

export function AboutPageEditor({ onDirtyChange, saveRef }: EditorProps) {
  const settings = useQuery(api.pages.getAboutForAdmin)
  const saveAbout = useMutation(api.pages.saveAbout)
  const upload = usePageImageUpload()
  const { form, setLoadedForm, updateForm } = useDirtyForm<AboutForm>(onDirtyChange)
  const loadedAtRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings === undefined || loadedAtRef.current === settings.updatedAt) return
    loadedAtRef.current = settings.updatedAt
    setLoadedForm({
      eyebrow: settings.eyebrow,
      heading: settings.heading,
      heroImage: settings.heroImage,
      philosophyEyebrow: settings.philosophyEyebrow,
      philosophyBody: settings.philosophyBody,
      philosophyMeta: settings.philosophyMeta,
      philosophyImages: settings.philosophyImages,
      driversEyebrow: settings.driversEyebrow,
      visionLabel: settings.visionLabel,
      visionBody: settings.visionBody,
      visionImage: settings.visionImage,
      missionLabel: settings.missionLabel,
      missionBody: settings.missionBody,
      missionImage: settings.missionImage,
      storyEyebrow: settings.storyEyebrow,
      storyHeading: settings.storyHeading,
      storyBody: settings.storyBody,
      storyHeroImage: settings.storyHeroImage,
      storyDetailImage: settings.storyDetailImage,
      valuesEyebrow: settings.valuesEyebrow,
      values: settings.values,
      sustainabilityEyebrow: settings.sustainabilityEyebrow,
      sustainabilityHeading: settings.sustainabilityHeading,
      sustainabilityItems: settings.sustainabilityItems,
    })
  }, [settings, setLoadedForm])

  const update = <K extends keyof AboutForm>(key: K, value: AboutForm[K]) =>
    updateForm((current) => (current ? { ...current, [key]: value } : current))

  const uploadImage = async (file: File, apply: (image: EditorImage) => void) => {
    setUploading(true)
    setError(null)
    try {
      apply(await upload(file))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Image upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!form) return false
    try {
      for (const [key, value] of Object.entries(form)) {
        if (typeof value === "string") requireContent(value, `${key} cannot be empty.`)
      }
      if (form.philosophyImages.length === 0) throw new Error("Add at least one philosophy image.")
      if (form.values.length === 0) throw new Error("Add at least one value.")
      for (const value of form.values) {
        requireContent(value.label, "Every value needs a label.")
        requireContent(value.body, "Every value needs a description.")
      }
      if (form.sustainabilityItems.length === 0)
        throw new Error("Add at least one sustainability item.")
      for (const item of form.sustainabilityItems) {
        requireContent(item.question, "Every sustainability item needs a question.")
        requireContent(item.answer, "Every sustainability item needs an answer.")
      }
      setSaving(true)
      setError(null)
      setMessage(null)
      await saveAbout({
        ...form,
        heroImage: form.heroImage.source,
        philosophyImages: form.philosophyImages.map((image) => image.source),
        visionImage: form.visionImage.source,
        missionImage: form.missionImage.source,
        storyHeroImage: form.storyHeroImage.source,
        storyDetailImage: form.storyDetailImage.source,
        values: form.values.map((value) => ({ ...value, image: value.image.source })),
      })
      onDirtyChange(false)
      setMessage("About page published.")
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.")
      return false
    } finally {
      setSaving(false)
    }
  }

  saveRef.current = save

  if (!form) return <EditorLoading title="About" />

  return (
    <PageEditorShell
      title="About"
      description="Edit the content while preserving the designed page layout."
      preview={<AboutPreview form={form} />}
      saving={saving}
      uploading={uploading}
      message={message}
      error={error}
      onSave={() => void save()}
    >
      <EditorSection title="Hero">
        <TextField
          label="Eyebrow"
          value={form.eyebrow}
          onChange={(value) => update("eyebrow", value)}
        />
        <TextArea
          label="Heading"
          value={form.heading}
          onChange={(value) => update("heading", value)}
        />
        <ImageField
          label="Hero image"
          image={form.heroImage}
          disabled={uploading}
          onUpload={(file) => void uploadImage(file, (image) => update("heroImage", image))}
        />
      </EditorSection>

      <EditorSection title="Philosophy">
        <TextField
          label="Eyebrow"
          value={form.philosophyEyebrow}
          onChange={(value) => update("philosophyEyebrow", value)}
        />
        <TextArea
          label="Body"
          value={form.philosophyBody}
          onChange={(value) => update("philosophyBody", value)}
        />
        <TextField
          label="Meta line"
          value={form.philosophyMeta}
          onChange={(value) => update("philosophyMeta", value)}
        />
        <RepeatableHeader
          label="Images"
          onAdd={
            form.philosophyImages.length < 4
              ? () =>
                  update("philosophyImages", [
                    ...form.philosophyImages,
                    form.philosophyImages.at(-1)!,
                  ])
              : undefined
          }
        />
        {form.philosophyImages.map((image, index) => (
          <RepeatableCard
            key={index}
            index={index}
            count={form.philosophyImages.length}
            onMove={(to) => update("philosophyImages", moveItem(form.philosophyImages, index, to))}
            onRemove={
              form.philosophyImages.length > 1
                ? () =>
                    update(
                      "philosophyImages",
                      form.philosophyImages.filter((_, itemIndex) => itemIndex !== index),
                    )
                : undefined
            }
          >
            <ImageField
              label={`Image ${index + 1}`}
              image={image}
              disabled={uploading}
              onUpload={(file) =>
                void uploadImage(file, (nextImage) =>
                  update(
                    "philosophyImages",
                    form.philosophyImages.map((item, itemIndex) =>
                      itemIndex === index ? nextImage : item,
                    ),
                  ),
                )
              }
            />
          </RepeatableCard>
        ))}
      </EditorSection>

      <EditorSection title="Vision and mission">
        <TextField
          label="Section eyebrow"
          value={form.driversEyebrow}
          onChange={(value) => update("driversEyebrow", value)}
        />
        <TextField
          label="Vision label"
          value={form.visionLabel}
          onChange={(value) => update("visionLabel", value)}
        />
        <TextArea
          label="Vision body"
          value={form.visionBody}
          onChange={(value) => update("visionBody", value)}
        />
        <ImageField
          label="Vision image"
          image={form.visionImage}
          disabled={uploading}
          onUpload={(file) => void uploadImage(file, (image) => update("visionImage", image))}
        />
        <TextField
          label="Mission label"
          value={form.missionLabel}
          onChange={(value) => update("missionLabel", value)}
        />
        <TextArea
          label="Mission body"
          value={form.missionBody}
          onChange={(value) => update("missionBody", value)}
        />
        <ImageField
          label="Mission image"
          image={form.missionImage}
          disabled={uploading}
          onUpload={(file) => void uploadImage(file, (image) => update("missionImage", image))}
        />
      </EditorSection>

      <EditorSection title="Story">
        <TextField
          label="Eyebrow"
          value={form.storyEyebrow}
          onChange={(value) => update("storyEyebrow", value)}
        />
        <TextArea
          label="Heading"
          value={form.storyHeading}
          onChange={(value) => update("storyHeading", value)}
        />
        <TextArea
          label="Body"
          value={form.storyBody}
          onChange={(value) => update("storyBody", value)}
        />
        <ImageField
          label="Main image"
          image={form.storyHeroImage}
          disabled={uploading}
          onUpload={(file) => void uploadImage(file, (image) => update("storyHeroImage", image))}
        />
        <ImageField
          label="Detail image"
          image={form.storyDetailImage}
          disabled={uploading}
          onUpload={(file) => void uploadImage(file, (image) => update("storyDetailImage", image))}
        />
      </EditorSection>

      <EditorSection title="Values">
        <TextField
          label="Section eyebrow"
          value={form.valuesEyebrow}
          onChange={(value) => update("valuesEyebrow", value)}
        />
        <RepeatableHeader
          label="Values"
          onAdd={
            form.values.length < 8
              ? () =>
                  update("values", [
                    ...form.values,
                    {
                      label: "New value",
                      body: "Describe this value.",
                      image: form.values.at(-1)!.image,
                    },
                  ])
              : undefined
          }
        />
        {form.values.map((value, index) => (
          <RepeatableCard
            key={index}
            index={index}
            count={form.values.length}
            onMove={(to) => update("values", moveItem(form.values, index, to))}
            onRemove={
              form.values.length > 1
                ? () =>
                    update(
                      "values",
                      form.values.filter((_, itemIndex) => itemIndex !== index),
                    )
                : undefined
            }
          >
            <TextField
              label="Label"
              value={value.label}
              onChange={(label) =>
                update(
                  "values",
                  form.values.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, label } : item,
                  ),
                )
              }
            />
            <TextArea
              label="Body"
              value={value.body}
              onChange={(body) =>
                update(
                  "values",
                  form.values.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, body } : item,
                  ),
                )
              }
            />
            <ImageField
              label="Image"
              image={value.image}
              disabled={uploading}
              onUpload={(file) =>
                void uploadImage(file, (image) =>
                  update(
                    "values",
                    form.values.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, image } : item,
                    ),
                  ),
                )
              }
            />
          </RepeatableCard>
        ))}
      </EditorSection>

      <EditorSection title="Sustainability">
        <TextField
          label="Eyebrow"
          value={form.sustainabilityEyebrow}
          onChange={(value) => update("sustainabilityEyebrow", value)}
        />
        <TextArea
          label="Heading"
          value={form.sustainabilityHeading}
          onChange={(value) => update("sustainabilityHeading", value)}
        />
        <AccordionFields
          items={form.sustainabilityItems}
          onChange={(items) => update("sustainabilityItems", items)}
        />
      </EditorSection>
    </PageEditorShell>
  )
}

export function ContactPageEditor({ onDirtyChange, saveRef }: EditorProps) {
  const settings = useQuery(api.pages.getContactForAdmin)
  const globalSettings = useQuery(api.pages.getGlobalForAdmin)
  const saveContact = useMutation(api.pages.saveContact)
  const { form, setLoadedForm, updateForm } = useDirtyForm<ContactForm>(onDirtyChange)
  const loadedAtRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings === undefined || loadedAtRef.current === settings.updatedAt) return
    loadedAtRef.current = settings.updatedAt
    setLoadedForm({
      eyebrow: settings.eyebrow,
      heading: settings.heading,
      studioName: settings.studioName,
      address: settings.address,
      faqHeading: settings.faqHeading,
      faqs: settings.faqs,
    })
  }, [settings, setLoadedForm])

  const update = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) =>
    updateForm((current) => (current ? { ...current, [key]: value } : current))

  const save = async () => {
    if (!form) return false
    try {
      for (const [key, value] of Object.entries(form)) {
        if (typeof value === "string") requireContent(value, `${key} cannot be empty.`)
      }
      if (form.faqs.length === 0) throw new Error("Add at least one FAQ.")
      for (const faq of form.faqs) {
        requireContent(faq.question, "Every FAQ needs a question.")
        requireContent(faq.answer, "Every FAQ needs an answer.")
      }
      setSaving(true)
      setError(null)
      setMessage(null)
      await saveContact(form)
      onDirtyChange(false)
      setMessage("Contact page published.")
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.")
      return false
    } finally {
      setSaving(false)
    }
  }

  saveRef.current = save

  if (!form || globalSettings === undefined) return <EditorLoading title="Contact" />

  return (
    <PageEditorShell
      title="Contact"
      description="Edit the essential contact-page copy and FAQs."
      preview={<ContactPreview form={form} globalContent={globalSettings} />}
      saving={saving}
      uploading={false}
      message={message}
      error={error}
      onSave={() => void save()}
    >
      <EditorSection title="Introduction">
        <TextField
          label="Eyebrow"
          value={form.eyebrow}
          onChange={(value) => update("eyebrow", value)}
        />
        <TextArea
          label="Heading"
          value={form.heading}
          onChange={(value) => update("heading", value)}
        />
      </EditorSection>
      <EditorSection title="Contact details">
        <p className="mb-5 text-sm leading-relaxed text-dark/55">
          Email and phone are managed in Global / Footer so they remain consistent across the site.
        </p>
        <TextField
          label="Studio name"
          value={form.studioName}
          onChange={(value) => update("studioName", value)}
        />
        <TextArea
          label="Address"
          value={form.address}
          onChange={(value) => update("address", value)}
        />
      </EditorSection>
      <EditorSection title="FAQs">
        <TextField
          label="Section heading"
          value={form.faqHeading}
          onChange={(value) => update("faqHeading", value)}
        />
        <AccordionFields items={form.faqs} onChange={(items) => update("faqs", items)} />
      </EditorSection>
    </PageEditorShell>
  )
}

export function GlobalPageEditor({ onDirtyChange, saveRef }: EditorProps) {
  const settings = useQuery(api.pages.getGlobalForAdmin)
  const saveGlobal = useMutation(api.pages.saveGlobal)
  const { form, setLoadedForm, updateForm } = useDirtyForm<GlobalForm>(onDirtyChange)
  const loadedAtRef = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (settings === undefined || loadedAtRef.current === settings.updatedAt) return
    loadedAtRef.current = settings.updatedAt
    setLoadedForm({ email: settings.email, phone: settings.phone })
  }, [settings, setLoadedForm])

  const update = <K extends keyof GlobalForm>(key: K, value: GlobalForm[K]) =>
    updateForm((current) => (current ? { ...current, [key]: value } : current))

  const save = async () => {
    if (!form) return false
    try {
      requireContent(form.email, "Email cannot be empty.")
      requireContent(form.phone, "Phone cannot be empty.")
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        throw new Error("Enter a valid email address.")
      }
      setSaving(true)
      setError(null)
      setMessage(null)
      await saveGlobal({ email: form.email.trim().toLowerCase(), phone: form.phone.trim() })
      onDirtyChange(false)
      setMessage("Global contact details published.")
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.")
      return false
    } finally {
      setSaving(false)
    }
  }

  saveRef.current = save

  if (!form) return <EditorLoading title="Global / Footer" />

  return (
    <PageEditorShell
      title="Global / Footer"
      description="Manage contact details shared by the footer and Contact page."
      preview={<GlobalPreview form={form} />}
      saving={saving}
      uploading={false}
      message={message}
      error={error}
      onSave={() => void save()}
    >
      <EditorSection title="Contact details">
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) => update("email", value)}
        />
        <TextField label="Phone" value={form.phone} onChange={(value) => update("phone", value)} />
        <p className="text-sm leading-relaxed text-dark/50">
          Saving updates every shared footer and the contact information shown on the Contact page.
        </p>
      </EditorSection>
    </PageEditorShell>
  )
}

function PageEditorShell({
  title,
  description,
  preview,
  saving,
  uploading,
  message,
  error,
  onSave,
  children,
}: {
  title: string
  description: string
  preview: React.ReactNode
  saving: boolean
  uploading: boolean
  message: string | null
  error: string | null
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="mb-3 text-xs tracking-[0.28em] text-dark/45 uppercase">Page editor</p>
          <h1 className="text-48">{title}</h1>
          <p className="mt-3 text-sm text-dark/55">{description}</p>
        </div>
        <button
          type="button"
          className="admin-primary"
          disabled={saving || uploading}
          onClick={onSave}
        >
          {saving ? "Saving..." : uploading ? "Uploading..." : "Save and publish"}
        </button>
      </header>
      {message ? (
        <p className="mb-5 rounded-lg bg-loam/10 px-4 py-3 text-sm text-loam">{message}</p>
      ) : null}
      {error ? (
        <p className="mb-5 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,0.82fr)_minmax(28rem,1.18fr)]">
        <div className="space-y-6">
          {children}
          <button
            type="button"
            className="admin-primary"
            disabled={saving || uploading}
            onClick={onSave}
          >
            {saving ? "Saving..." : "Save and publish"}
          </button>
        </div>
        <div className="sticky top-8">
          <p className="mb-3 text-xs tracking-[0.2em] text-dark/45 uppercase">Live preview</p>
          <div className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-dark/15 bg-canvas shadow-xl">
            {preview}
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorLoading({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-48">{title}</h1>
      <p className="mt-8 text-sm text-dark/55">Loading...</p>
    </section>
  )
}
function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="admin-card">
      <h2 className="mb-5 text-xl font-semibold tracking-normal">{title}</h2>
      {children}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm outline-none focus:border-dark/45"
      />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded-lg border border-dark/15 bg-canvas px-4 py-3 text-sm leading-relaxed outline-none focus:border-dark/45"
      />
    </label>
  )
}

function ImageField({
  label,
  image,
  disabled,
  onUpload,
}: {
  label: string
  image: EditorImage
  disabled: boolean
  onUpload: (file: File) => void
}) {
  return (
    <div className="mb-5">
      <span className="mb-2 block text-xs tracking-[0.2em] text-dark/55 uppercase">{label}</span>
      <div className="flex items-center gap-4 rounded-lg border border-dark/10 p-3">
        <img src={image.url} alt="" className="h-20 w-20 rounded-md object-cover" />
        <label className="admin-secondary">
          <span>{disabled ? "Uploading..." : "Replace image"}</span>
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onUpload(file)
              event.target.value = ""
            }}
          />
        </label>
      </div>
    </div>
  )
}

function RepeatableHeader({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm font-medium">{label}</p>
      {onAdd ? (
        <button type="button" className="admin-secondary py-2" onClick={onAdd}>
          Add
        </button>
      ) : null}
    </div>
  )
}

function RepeatableCard({
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  index: number
  count: number
  onMove: (index: number) => void
  onRemove?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-3 rounded-lg border border-dark/10 p-4">
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          className="admin-secondary px-3 py-1.5"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="admin-secondary px-3 py-1.5"
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          ↓
        </button>
        {onRemove ? (
          <button
            type="button"
            className="admin-secondary px-3 py-1.5 text-red-700"
            onClick={onRemove}
          >
            Remove
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function AccordionFields({
  items,
  onChange,
}: {
  items: AccordionItem[]
  onChange: (items: AccordionItem[]) => void
}) {
  return (
    <>
      <RepeatableHeader
        label="Items"
        onAdd={
          items.length < 12
            ? () => onChange([...items, { question: "New item", answer: "Add the details here." }])
            : undefined
        }
      />
      {items.map((item, index) => (
        <RepeatableCard
          key={index}
          index={index}
          count={items.length}
          onMove={(to) => onChange(moveItem(items, index, to))}
          onRemove={
            items.length > 1
              ? () => onChange(items.filter((_, itemIndex) => itemIndex !== index))
              : undefined
          }
        >
          <TextField
            label="Question"
            value={item.question}
            onChange={(question) =>
              onChange(
                items.map((current, itemIndex) =>
                  itemIndex === index ? { ...current, question } : current,
                ),
              )
            }
          />
          <TextArea
            label="Answer"
            value={item.answer}
            onChange={(answer) =>
              onChange(
                items.map((current, itemIndex) =>
                  itemIndex === index ? { ...current, answer } : current,
                ),
              )
            }
          />
        </RepeatableCard>
      ))}
    </>
  )
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function PreviewEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[8px] font-medium tracking-[0.18em] text-dark/45 uppercase">
      {children}
    </p>
  )
}

function AboutPreview({ form }: { form: AboutForm }) {
  return (
    <div className="text-dark">
      <div className="p-5">
        <img src={form.heroImage.url} alt="" className="mb-5 h-44 w-full object-cover" />
        <PreviewEyebrow>{form.eyebrow}</PreviewEyebrow>
        <h2 className="font-title text-5xl leading-[0.92]">{form.heading}</h2>
      </div>
      <div className="grid grid-cols-2 gap-5 border-t border-dark/10 p-5">
        <div>
          <PreviewEyebrow>{form.philosophyEyebrow}</PreviewEyebrow>
          <p className="text-xs leading-relaxed text-dark/60">{form.philosophyBody}</p>
          <p className="mt-4 text-[8px] tracking-widest text-dark/35 uppercase">
            {form.philosophyMeta}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {form.philosophyImages.map((image, index) => (
            <img key={index} src={image.url} alt="" className="aspect-square w-full object-cover" />
          ))}
        </div>
      </div>
      <div className="border-t border-dark/10 p-5">
        <PreviewEyebrow>{form.driversEyebrow}</PreviewEyebrow>
        <div className="grid grid-cols-2 gap-4">
          {[
            [form.visionLabel, form.visionBody, form.visionImage],
            [form.missionLabel, form.missionBody, form.missionImage],
          ].map(([label, body, image]) => (
            <div key={label as string}>
              <p className="mb-2 text-[8px] uppercase">{label as string}</p>
              <p className="mb-3 text-sm leading-tight">{body as string}</p>
              <img
                src={(image as EditorImage).url}
                alt=""
                className="aspect-square w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-dark/10">
        <img src={form.storyHeroImage.url} alt="" className="h-full min-h-72 w-full object-cover" />
        <div className="p-5">
          <PreviewEyebrow>{form.storyEyebrow}</PreviewEyebrow>
          <h3 className="font-title text-3xl leading-none">{form.storyHeading}</h3>
          <p className="my-4 text-[10px] leading-relaxed text-dark/60">{form.storyBody}</p>
          <img
            src={form.storyDetailImage.url}
            alt=""
            className="aspect-square w-full object-cover"
          />
        </div>
      </div>
      <div className="border-t border-dark/10 p-5">
        <PreviewEyebrow>{form.valuesEyebrow}</PreviewEyebrow>
        <div className="grid grid-cols-2 gap-3">
          {form.values.map((value, index) => (
            <div key={index}>
              <h3 className="font-title text-2xl">{value.label}</h3>
              <p className="mb-2 text-[9px] leading-relaxed text-dark/55">{value.body}</p>
              <img src={value.image.url} alt="" className="aspect-square w-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-dark/10 p-5">
        <PreviewEyebrow>{form.sustainabilityEyebrow}</PreviewEyebrow>
        <h3 className="mb-4 font-title text-3xl">{form.sustainabilityHeading}</h3>
        {form.sustainabilityItems.map((item, index) => (
          <div key={index} className="border-t border-dark/15 py-3">
            <p className="text-xs font-medium">{item.question}</p>
            <p className="mt-1 text-[9px] leading-relaxed text-dark/55">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactPreview({ form, globalContent }: { form: ContactForm; globalContent: GlobalForm }) {
  return (
    <div className="grid min-h-[38rem] grid-cols-2 gap-8 p-7 text-dark">
      <div className="flex flex-col justify-between">
        <div>
          <PreviewEyebrow>{form.eyebrow}</PreviewEyebrow>
          <h2 className="mb-8 font-title text-4xl leading-none">{form.heading}</h2>
          <img src="/stryk-logo-128.png" alt="" className="mb-1 h-6 w-6" />
          <p className="text-xs font-medium">{form.studioName}</p>
          <p className="mt-3 text-[10px] leading-relaxed whitespace-pre-line text-dark/60">
            {form.address}
          </p>
          <p className="mt-2 text-[10px] text-dark/60">
            {globalContent.email}
            <br />
            {globalContent.phone}
          </p>
        </div>
        <div>
          <PreviewEyebrow>{form.faqHeading}</PreviewEyebrow>
          {form.faqs.map((faq, index) => (
            <div key={index} className="border-t border-dark/15 py-2">
              <p className="text-[10px]">{faq.question}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        {["First name", "Last name", "Email address", "Phone number"].map((label) => (
          <div key={label} className="mb-4">
            <PreviewEyebrow>{label}</PreviewEyebrow>
            <div className="h-8 rounded-md border border-dark/20" />
          </div>
        ))}
        <PreviewEyebrow>Message</PreviewEyebrow>
        <div className="h-24 rounded-md border border-dark/20" />
        <div className="mt-5 rounded-md bg-dark py-3 text-center text-[10px] text-canvas">
          Send message
        </div>
      </div>
    </div>
  )
}

function GlobalPreview({ form }: { form: GlobalForm }) {
  return (
    <footer className="p-7 text-dark">
      <div className="flex items-end justify-between gap-8 border-t border-dark/10 pt-8">
        <div className="flex flex-col gap-5">
          <div className="flex gap-5 text-[9px] tracking-widest text-dark/45 uppercase">
            <span>Collections</span>
            <span>About</span>
            <span>Contact</span>
          </div>
          <div className="text-xs leading-relaxed text-dark/55">
            <p>{form.email}</p>
            <p>{form.phone}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <img src="/stryk-logo-128.png" alt="" className="mb-1 h-8 w-auto opacity-80" />
          <span className="text-[9px] text-dark/35">
            © {new Date().getFullYear()} Stryk Studios
          </span>
          <span className="text-[9px] text-dark/25">Made by Social Satisfaction</span>
        </div>
      </div>
    </footer>
  )
}
