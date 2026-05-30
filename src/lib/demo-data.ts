import type { Product } from "./types"

// Verified ceramic/pottery/tableware Unsplash images (IDs extracted from photo pages)
const IMAGES = [
  "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&q=80",
  "https://images.unsplash.com/photo-1597696929736-6d13bed8e6a8?w=600&q=80",
  "https://images.unsplash.com/photo-1610219171189-286769cc9b20?w=600&q=80",
  "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?w=600&q=80",
  "https://images.unsplash.com/photo-1598048851887-0263d4f43e73?w=600&q=80",
  "https://images.unsplash.com/photo-1617784625140-515e220ba148?w=600&q=80",
  "https://images.unsplash.com/photo-1626897885636-dd68020cc52a?w=600&q=80",
  "https://images.unsplash.com/photo-1594368247117-6012a8acda3e?w=600&q=80",
  "https://images.unsplash.com/photo-1741527444744-3ee07ccc2d72?w=600&q=80",
  "https://images.unsplash.com/photo-1650959858546-d09833d5317b?w=600&q=80",
  "https://images.unsplash.com/photo-1660721671073-e139688fa3cf?w=600&q=80",
  "https://images.unsplash.com/photo-1551807306-4bcd16b92a41?w=600&q=80",
  "https://images.unsplash.com/photo-1619367302084-3d07eb49159f?w=600&q=80",
  "https://images.unsplash.com/photo-1551546785-423f456af418?w=600&q=80",
  "https://images.unsplash.com/photo-1609881822242-f26da08bf76a?w=600&q=80",
  "https://images.unsplash.com/photo-1595351297944-cc4f8f78558b?w=600&q=80",
]

const COLLECTIONS = [
  { slug: "terra",    name: "Terra",    color: "#635858" },
  { slug: "midori",   name: "Midori",   color: "#506157" },
  { slug: "mist",     name: "Mist",     color: "#bbc1c8" },
  { slug: "dust",     name: "Dust",     color: "#f3e0cf" },
  { slug: "wisteria", name: "Wisteria", color: "#8b7fa8" },
  { slug: "cobalt",   name: "Cobalt",   color: "#4a699f" },
  { slug: "sage",     name: "Sage",     color: "#7a9e7e" },
  { slug: "ivory",    name: "Ivory",    color: "#e8dcc8" },
  { slug: "onyx",     name: "Onyx",     color: "#2c2c2c" },
  { slug: "clay",     name: "Clay",     color: "#b5836a" },
]

const PIECES = ["Dinner Plate", "Side Plate", "Bowl", "Deep Plate", "Mug"]

const PIECE_DESCS = [
  "A wide, generous plate that anchors every table setting with quiet confidence.",
  "A compact plate perfect for bread, appetisers, or a small shared course.",
  "A deep, rounded bowl suited to soups, grains, and abundant salads.",
  "A shallow bowl with a broad rim that holds sauces and sides with ease.",
  "A sturdy, balanced mug shaped for slow mornings and unhurried afternoons.",
]

let globalIdx = 0

export const DEMO_PRODUCTS: Product[] = COLLECTIONS.flatMap((col) =>
  PIECES.map((piece, pi) => {
    const idx = globalIdx++
    return {
      id: `${col.slug}-${pi}`,
      slug: `${col.slug}-${piece.toLowerCase().replace(" ", "-")}`,
      name: `${col.name} ${piece}`,
      description: PIECE_DESCS[pi],
      collectionName: col.name,
      collectionSlug: col.slug,
      image: IMAGES[idx % IMAGES.length],
      images: [
        IMAGES[idx % IMAGES.length],
        IMAGES[(idx + 5) % IMAGES.length],
        IMAGES[(idx + 10) % IMAGES.length],
      ],
      price: 28 + pi * 10,
      color: col.color,
      size: ["26cm", "21cm", "16cm", "22cm", "9cm"][pi],
      available: true,
    }
  }),
)
// 10 collections × 5 pieces = 50 products
