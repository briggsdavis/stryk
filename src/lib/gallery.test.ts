import { describe, expect, it } from "vitest"
import { galleryIndexForImage, mediaKey } from "./gallery"

const IMAGES = [
  "https://cdn.example/cover.jpg",
  "https://cdn.example/art-1.jpg",
  "https://cdn.example/art-2.jpg",
  "https://cdn.example/art-3.jpg",
]

describe("mediaKey", () => {
  it("strips the query string", () => {
    expect(mediaKey("https://cdn.example/art-1.jpg?w=900&q=80")).toBe(
      "https://cdn.example/art-1.jpg",
    )
  })

  it("handles undefined", () => {
    expect(mediaKey(undefined)).toBe("")
  })
})

describe("galleryIndexForImage", () => {
  it("returns the index of a matching artwork image", () => {
    expect(galleryIndexForImage(IMAGES, "https://cdn.example/art-2.jpg")).toBe(2)
  })

  it("matches even when transform params differ", () => {
    expect(galleryIndexForImage(IMAGES, "https://cdn.example/art-3.jpg?w=1200&q=90")).toBe(3)
  })

  it("falls back to 0 when the image is not in the gallery", () => {
    expect(galleryIndexForImage(IMAGES, "https://cdn.example/other.jpg")).toBe(0)
  })

  it("falls back to 0 for the cover image (index 0 is not a buyable artwork)", () => {
    expect(galleryIndexForImage(IMAGES, "https://cdn.example/cover.jpg")).toBe(0)
  })

  it("returns 0 when no image is provided (canvas/grid open)", () => {
    expect(galleryIndexForImage(IMAGES, null)).toBe(0)
    expect(galleryIndexForImage(IMAGES, undefined)).toBe(0)
  })
})
