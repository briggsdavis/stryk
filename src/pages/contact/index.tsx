import { clsx } from "clsx"
import { useMutation, useQuery } from "convex/react"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { api } from "../../../convex/_generated/api"
import { Accordion } from "../../components/ui/accordion"
import { Footer } from "../../components/ui/footer"
import { HoverLabel } from "../../components/ui/hover-label"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"

type InquiryKey = "general" | "custom" | "order"

interface FieldState {
  value: string
  status: "idle" | "success" | "error"
}

const emptyField = (): FieldState => ({ value: "", status: "idle" })

export function ContactPage() {
  useLenis()
  const content = useQuery(api.pages.getContact)
  const globalContent = useQuery(api.pages.getGlobal)

  const [searchParams] = useSearchParams()
  const inquiryType: InquiryKey = searchParams.get("inquiry") === "custom" ? "custom" : "general"
  const [fields, setFields] = useState({
    firstName: emptyField(),
    lastName: emptyField(),
    email: emptyField(),
    phone: emptyField(),
    reference: { value: searchParams.get("product") ?? "", status: "idle" } as FieldState,
    size: emptyField(),
    message: emptyField(),
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitContact = useMutation(api.inquiries.submitContact)

  const set = (key: keyof typeof fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: { value, status: "idle" } }))

  const validate = () => {
    let valid = true
    const next = { ...fields }

    if (!fields.firstName.value.trim()) {
      next.firstName = { ...next.firstName, status: "error" }
      valid = false
    }
    if (!fields.lastName.value.trim()) {
      next.lastName = { ...next.lastName, status: "error" }
      valid = false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value)) {
      next.email = { ...next.email, status: "error" }
      valid = false
    }
    if (!fields.message.value.trim()) {
      next.message = { ...next.message, status: "error" }
      valid = false
    }
    if (inquiryType === "custom" && !fields.size.value.trim()) {
      next.size = { ...next.size, status: "error" }
      valid = false
    }

    if (!valid) setFields(next)
    return valid
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await submitContact({
        inquiryType,
        firstName: fields.firstName.value.trim(),
        lastName: fields.lastName.value.trim(),
        email: fields.email.value.trim().toLowerCase(),
        phone: fields.phone.value.trim() || undefined,
        reference: fields.reference.value.trim() || undefined,
        size: fields.size.value.trim() || undefined,
        message: fields.message.value.trim(),
      })
      setSubmitted(true)
    } catch {
      setSubmitError("Could not send your message. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (content === undefined || globalContent === undefined)
    return <div className="min-h-screen bg-canvas" />

  return (
    <div className="min-h-screen bg-canvas text-dark">
      <Navbar />

      <div className="grid min-h-screen gap-16 px-6 pt-36 pb-24 md:grid-cols-2 md:px-10 md:pt-40">
        {/* Left - info */}
        <div className="flex flex-col justify-between">
          <div>
            <p className="mb-4 text-xs font-medium tracking-widest text-dark/50 uppercase">
              {content.eyebrow}
            </p>
            <h1 className="text-64 mb-12 leading-tight font-medium">{content.heading}</h1>
            <div className="space-y-4 text-sm text-dark/60">
              {/* Logo sized to match the wordmark's width: the inline-block box
                  shrinks to the text (w-0 keeps the image from widening it), and
                  min-w-full then stretches the image back to that text width. */}
              <div className="inline-block">
                <img
                  src="/stryk-logo-128.png"
                  alt=""
                  aria-hidden="true"
                  className="mb-2 block h-auto w-0 min-w-full"
                />
                <p className="font-medium text-dark">{content.studioName}</p>
              </div>
              <p className="whitespace-pre-line">{content.address}</p>
              <a
                href={`mailto:${globalContent.email}`}
                className="block transition-colors hover:text-dark"
              >
                {globalContent.email}
              </a>
              <a
                href={`tel:${globalContent.phone.replace(/[^+\d]/g, "")}`}
                className="block transition-colors hover:text-dark"
              >
                {globalContent.phone}
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <p className="mb-6 text-xs font-medium tracking-widest text-dark/50 uppercase">
              {content.faqHeading}
            </p>
            <Accordion items={content.faqs} />
          </div>
        </div>

        {/* Right - form */}
        <div className="flex items-start justify-center pt-4 md:pt-0">
          {submitted ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center border border-dark/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-8 w-8 text-loam"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-24 font-medium">Message sent</p>
              <p className="text-sm text-dark/50">We'll be in touch within 1–2 business days.</p>
            </div>
          ) : (
            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="w-full max-w-lg space-y-5"
            >
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="First name"
                  value={fields.firstName.value}
                  status={fields.firstName.status}
                  onChange={(v) => set("firstName", v)}
                />
                <Field
                  label="Last name"
                  value={fields.lastName.value}
                  status={fields.lastName.status}
                  onChange={(v) => set("lastName", v)}
                />
              </div>
              <Field
                label="Email address"
                type="email"
                value={fields.email.value}
                status={fields.email.status}
                onChange={(v) => set("email", v)}
              />
              <Field
                label="Phone number"
                type="tel"
                value={fields.phone.value}
                status={fields.phone.status}
                onChange={(v) => set("phone", v)}
              />

              {/* Custom-print specifics */}
              {inquiryType === "custom" && (
                <>
                  <Field
                    label="Reference artwork"
                    value={fields.reference.value}
                    status={fields.reference.status}
                    onChange={(v) => set("reference", v)}
                  />
                  <Field
                    label="Desired size"
                    value={fields.size.value}
                    status={fields.size.status}
                    onChange={(v) => set("size", v)}
                  />
                </>
              )}

              <div className="relative">
                <label
                  htmlFor="contact-message"
                  className="mb-1.5 block text-xs font-medium tracking-widest text-dark/50 uppercase"
                >
                  {inquiryType === "custom" ? "Comments" : "Message"}
                </label>
                <textarea
                  id="contact-message"
                  aria-label={inquiryType === "custom" ? "Comments" : "Message"}
                  rows={5}
                  value={fields.message.value}
                  onChange={(e) => set("message", e.target.value)}
                  className={clsx(
                    "w-full resize-none rounded-lg border bg-transparent px-4 py-3 text-sm text-dark outline-none transition-colors duration-200 placeholder:text-dark/30",
                    fields.message.status === "error"
                      ? "border-red-400/60"
                      : "border-dark/20 focus:border-dark/50",
                  )}
                  placeholder={
                    inquiryType === "custom"
                      ? "Tell us about colours, finish, quantity, deadline…"
                      : "Your message..."
                  }
                />
                <FieldIcon status={fields.message.status} />
              </div>

              {submitError && <p className="text-sm text-red-700">{submitError}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-dark px-6 py-3 text-sm font-medium tracking-wide text-canvas transition-all duration-300 hover:bg-dark/80"
              >
                <HoverLabel>{isSubmitting ? "Sending..." : "Send message"}</HoverLabel>
              </button>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}

interface FieldProps {
  label: string
  type?: string
  value: string
  status: "idle" | "success" | "error"
  onChange: (v: string) => void
}

function Field({ label, type = "text", value, status, onChange }: FieldProps) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium tracking-widest text-dark/50 uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(
          "w-full rounded-lg border bg-transparent px-4 py-3 text-sm text-dark outline-none transition-colors duration-200 placeholder:text-dark/30",
          status === "error"
            ? "border-red-400/60"
            : status === "success"
              ? "border-loam/60"
              : "border-dark/20 focus:border-dark/50",
        )}
      />
      <FieldIcon status={status} />
    </div>
  )
}

function FieldIcon({ status }: { status: "idle" | "success" | "error" }) {
  if (status === "idle") return null
  return (
    <div className="pointer-events-none absolute top-9 right-3">
      {status === "success" ? (
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-loam">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
          <polyline points="5 8 7 10 11 6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 text-red-400">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
          <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="11.5" r="0.8" fill="currentColor" />
        </svg>
      )}
    </div>
  )
}
