import type { Product, ProductCategory } from "./types"

// Named colour buckets for the canvas colour filter. Spread across pieces so a
// single collection contains a mix of colours rather than one flat tone.
const COLOR_NAMES = ["Black", "Cream", "Green", "Blue", "Terracotta", "Grey"]
const CATEGORIES: ProductCategory[] = ["hotel", "misc", "restaurant", "empties"]

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
  { slug: "tokyo", name: "Tokyo", color: "#635858" },
  { slug: "nairobi", name: "Nairobi", color: "#506157" },
  { slug: "paris", name: "Paris", color: "#bbc1c8" },
  { slug: "berlin", name: "Berlin", color: "#f3e0cf" },
  { slug: "kyoto", name: "Kyoto", color: "#8b7fa8" },
  { slug: "new-york", name: "New York", color: "#4a699f" },
  { slug: "california", name: "California", color: "#7a9e7e" },
  { slug: "milano", name: "Milano", color: "#e8dcc8" },
  { slug: "hamburg", name: "Hamburg", color: "#2c2c2c" },
  { slug: "lyon", name: "Lyon", color: "#b5836a" },
]

const PIECES = ["Matchbox", "Matchbook", "Album Cover", "Brand Archive", "Limited Edition"]

const PIECE_DESCS = [
  "A striking matchbox label sourced from the streets of a city that knew how to make an impression.",
  "A slim matchbook whose cover art distils an era's graphic energy into a single folded moment.",
  "Reimagined as album artwork - this label channels the mood of a record that defined its decade.",
  "Pulled from brand archives, this piece bears the mark of a company that shaped its city's visual culture.",
  "A limited-run reprint of a rare label, hand-selected for its rarity, colour, and extraordinary design.",
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
        IMAGES[(idx + 3) % IMAGES.length],
        IMAGES[(idx + 6) % IMAGES.length],
        IMAGES[(idx + 9) % IMAGES.length],
        IMAGES[(idx + 12) % IMAGES.length],
      ],
      price: 28 + pi * 10,
      color: col.color,
      colorName: COLOR_NAMES[idx % COLOR_NAMES.length],
      category: CATEGORIES[idx % CATEGORIES.length],
      size: ["5.5 × 3.5 cm", "4.5 × 4.5 cm", "31 × 31 cm", "5.5 × 3.5 cm", "14 × 9 cm"][pi],
      available: true,
    }
  }),
)
// 10 collections × 5 pieces = 50 products
