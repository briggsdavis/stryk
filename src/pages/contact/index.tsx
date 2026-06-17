import { clsx } from "clsx"
import { useMutation } from "convex/react"
import { useState } from "react"
import { useSearchParams } from "react-router"
import { api } from "../../../convex/_generated/api"
import { Accordion } from "../../components/ui/accordion"
import { Footer } from "../../components/ui/footer"
import { HoverLabel } from "../../components/ui/hover-label"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"

const INQUIRY_TYPES = [
  { key: "general", label: "General" },
  { key: "custom", label: "Custom print" },
  { key: "order", label: "Order support" },
] as const

type InquiryKey = (typeof INQUIRY_TYPES)[number]["key"]

const FAQ_ITEMS = [
  {
    question: "Are these original pieces or reprints?",
    answer:
      "Both. Each listing specifies whether it is an original vintage piece, a limited archival reprint, or a framed reproduction. Originals are one-of-a-kind; reprints are produced in numbered runs on acid-free stock.",
  },
  {
    question: "Do you ship internationally?",
    answer:
      "Yes - we ship worldwide. All pieces are wrapped in archival tissue and packed in rigid board mailers to survive the journey. Tracking is included on every order.",
  },
  {
    question: "Can I request a piece from a specific country or era?",
    answer:
      "Absolutely. Use the contact form to describe what you're after - city, decade, style - and we'll search our current stock and upcoming sourcing trips for a match.",
  },
]

interface FieldState {
  value: string
  status: "idle" | "success" | "error"
}

const emptyField = (): FieldState => ({ value: "", status: "idle" })

export function ContactPage() {
  useLenis()

  const [searchParams] = useSearchParams()
  const initialInquiry: InquiryKey = searchParams.get("inquiry") === "custom" ? "custom" : "general"

  const [inquiryType, setInquiryType] = useState<InquiryKey>(initialInquiry)
  const [fields, setFields] = useState({
    firstName: emptyField(),
    lastName: emptyField(),
    email: emptyField(),
    phone: emptyField(),
    reference: { value: searchParams.get("product") ?? "", status: "idle" } as FieldState,
    size: emptyField(),
    message: emptyField(),
  })
  const [terms, setTerms] = useState(false)
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
    if (!validate() || !terms) return
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

  return (
    <div className="min-h-screen bg-canvas text-dark">
      <Navbar />

      <div className="grid min-h-screen gap-16 px-6 pt-36 pb-24 md:grid-cols-2 md:px-10 md:pt-40">
        {/* Left - info */}
        <div className="flex flex-col justify-between">
          <div>
            <p className="mb-4 text-xs font-medium tracking-widest text-dark/50 uppercase">
              Get in touch
            </p>
            <h1 className="text-64 mb-12 leading-tight font-medium">
              Tell us what you're hunting for
            </h1>
            <div className="space-y-4 text-sm text-dark/60">
              <p className="font-medium text-dark">Stryk Studio</p>
              <p>
                1234 Maker Street
                <br />
                New York, NY 10001
              </p>
              <a href="mailto:info@stryk.co" className="block transition-colors hover:text-dark">
                info@stryk.co
              </a>
              <a href="tel:+12125550100" className="block transition-colors hover:text-dark">
                +1 212 555 0100
              </a>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16">
            <p className="mb-6 text-xs font-medium tracking-widest text-dark/50 uppercase">FAQ</p>
            <Accordion items={FAQ_ITEMS} />
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
              {/* Inquiry type */}
              <div>
                <p className="mb-1.5 block text-xs font-medium tracking-widest text-dark/50 uppercase">
                  Inquiry type
                </p>
                <div className="flex flex-wrap gap-2">
                  {INQUIRY_TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setInquiryType(key)}
                      aria-pressed={inquiryType === key}
                      className={clsx(
                        "group rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
                        inquiryType === key
                          ? "border-dark bg-dark text-canvas"
                          : "border-dark/20 text-dark hover:border-dark/40",
                      )}
                    >
                      <HoverLabel>{label}</HoverLabel>
                    </button>
                  ))}
                </div>
              </div>

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

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  aria-label="I agree to the Terms & Conditions"
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={clsx(
                    "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center border transition-colors",
                    terms ? "border-dark bg-dark" : "border-dark/30",
                  )}
                >
                  {terms && (
                    <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
                      <polyline points="1 4 3.5 6.5 9 1" stroke="#f0ede6" strokeWidth="1.5" />
                    </svg>
                  )}
                </span>
                <span className="text-xs text-dark/50">
                  I agree to the{" "}
                  <button type="button" className="underline hover:text-dark">
                    Terms & Conditions
                  </button>
                </span>
              </label>

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
