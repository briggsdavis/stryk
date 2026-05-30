import { useRef } from "react"
import { Accordion } from "../../components/ui/accordion"
import { Navbar } from "../../components/ui/navbar"
import { useLenis } from "../../hooks/use-lenis"
import { useImageReveal, useSplitReveal } from "../../hooks/use-scroll-reveal"

const SUSTAINABILITY_ITEMS = [
  {
    question: "Ethical production",
    answer:
      "Every piece is made in certified facilities that ensure fair wages, safe working conditions, and responsible manufacturing practices.",
  },
  {
    question: "Longevity and durability",
    answer:
      "We design for decades, not seasons. Our stoneware is fired at high temperatures to resist chipping and withstand daily use for generations.",
  },
  {
    question: "Sustainable materials",
    answer:
      "We source clay and glazes from suppliers who meet strict environmental standards, minimising our impact from raw material to finished piece.",
  },
  {
    question: "Responsible packaging",
    answer:
      "All packaging is made from recycled or FSC-certified materials and is fully recyclable. We've eliminated all single-use plastics from our supply chain.",
  },
]

const VALUES = [
  {
    label: "Quality",
    body: "Every detail is considered. We refuse to compromise on materials, process, or finish.",
  },
  {
    label: "Love",
    body: "We make things because we love making them — and because we love the rituals they serve.",
  },
  {
    label: "Creative & Bold",
    body: "We push form and glaze into new territory without losing sight of function.",
  },
  {
    label: "Original",
    body: "No trends, no fast cycles. Each collection is its own complete thought.",
  },
]

export function AboutPage() {
  useLenis()

  const h1Ref = useRef<HTMLHeadingElement>(null)
  const bodyTextRef = useRef<HTMLParagraphElement>(null)
  const storyHeadingRef = useRef<HTMLHeadingElement>(null)

  useSplitReveal(h1Ref)
  useSplitReveal(bodyTextRef)
  useSplitReveal(storyHeadingRef)

  const { wrapRef: imgWrapRef, maskRef: imgMaskRef } = useImageReveal()

  return (
    <div className="bg-dark text-light">
      <Navbar />

      {/* ── Hero ── */}
      <section className="flex min-h-screen flex-col justify-end px-8 pt-32 pb-20 md:px-16">
        <p className="mb-4 text-xs font-medium tracking-widest text-light/50 uppercase">
          About Stryk
        </p>
        <h1 ref={h1Ref} className="text-128 max-w-4xl overflow-hidden font-medium">
          Let's celebrate
        </h1>
      </section>

      {/* ── Body + Image ── */}
      <section className="grid gap-16 px-8 py-24 md:grid-cols-2 md:px-16">
        <div className="flex flex-col justify-center">
          <p ref={bodyTextRef} className="text-24 max-w-lg leading-relaxed text-light/80">
            Every meal is a celebration when it's shared around a beautifully laid table. We make
            dinnerware that invites you to slow down, set the table with intention, and savour the
            ordinary moments that make up a life.
          </p>
        </div>
        <div ref={imgWrapRef} className="image-mask-wrap aspect-[3/4] overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80"
            alt="Stryk dinnerware"
            className="h-full w-full object-cover"
          />
          <div ref={imgMaskRef} className="image-mask" />
        </div>
      </section>

      {/* ── Vision / Mission ── */}
      <section className="grid gap-16 border-t border-light/10 px-8 py-24 md:grid-cols-2 md:px-16">
        <div>
          <h3 className="text-32 mb-6 font-medium text-light/40">Our Vision</h3>
          <p className="text-64 leading-tight font-light">
            A world where the table is the centre of connection.
          </p>
        </div>
        <div>
          <h3 className="text-32 mb-6 font-medium text-light/40">Our Mission</h3>
          <p className="text-64 leading-tight font-light">
            To make dinnerware that outlasts trends and earns its place on every table.
          </p>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="bg-[#222] px-8 py-24 md:px-16">
        <p className="mb-4 text-xs font-medium tracking-widest text-light/50 uppercase">
          Our Story
        </p>
        <h2 ref={storyHeadingRef} className="text-128 mb-16 max-w-3xl overflow-hidden font-medium">
          Built from a shared table
        </h2>
        <div className="aspect-video w-full overflow-hidden bg-light/5">
          <img
            src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80"
            alt="Our story"
            className="h-full w-full object-cover opacity-70"
          />
        </div>
        <p className="text-18 mt-12 max-w-2xl leading-relaxed text-light/60">
          Founded by a family of makers, Stryk began as a small studio operation in 2018. We wanted
          to fill a gap — between mass-produced tableware that chips in a year and heirloom pieces
          that cost a fortune. Today we make everything in small batches, by hand, from materials we
          can stand behind.
        </p>
      </section>

      {/* ── Values ── */}
      <section className="px-8 py-24 md:px-16">
        <p className="mb-12 text-xs font-medium tracking-widest text-light/50 uppercase">
          What we stand for
        </p>
        <div className="grid gap-0 divide-y divide-light/10">
          {VALUES.map((v) => (
            <div key={v.label} className="group flex items-start justify-between gap-8 py-8">
              <h3 className="text-48 font-medium transition-opacity duration-300 group-hover:opacity-60">
                {v.label}
              </h3>
              <p className="text-18 mt-2 max-w-sm text-light/50">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sustainability ── */}
      <section className="border-t border-light/10 px-8 py-24 md:px-16">
        <p className="mb-4 text-xs font-medium tracking-widest text-light/50 uppercase">
          Sustainability
        </p>
        <h2 className="text-64 mb-12 font-medium">How we operate</h2>
        <Accordion items={SUSTAINABILITY_ITEMS} />
      </section>

      {/* ── Newsletter ── */}
      <section className="border-t border-light/10 px-8 py-24 md:px-16">
        <h2 className="text-48 mb-8 font-medium">Stay in the loop</h2>
        <form className="flex max-w-md gap-0" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            aria-label="Email address"
            placeholder="your@email.com"
            className="flex-1 border border-r-0 border-light/20 bg-transparent px-4 py-3 text-sm text-light outline-none placeholder:text-light/30 focus:border-light/50"
          />
          <button type="submit" className="btn-filled flex-shrink-0 border border-light/20 text-sm">
            Subscribe
          </button>
        </form>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-light/10 px-8 py-12 md:px-16">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium">Stryk</p>
            <p className="text-sm text-light/40">info@stryk.co</p>
          </div>
          <div className="flex gap-8">
            <button
              type="button"
              className="text-xs tracking-widest text-light/40 uppercase hover:text-light"
            >
              Instagram
            </button>
            <button
              type="button"
              className="text-xs tracking-widest text-light/40 uppercase hover:text-light"
            >
              Pinterest
            </button>
          </div>
        </div>
        <p className="mt-12 text-xs text-light/20">
          © {new Date().getFullYear()} Stryk. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
