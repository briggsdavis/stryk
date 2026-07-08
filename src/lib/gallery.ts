// Strip the query string so the same asset requested with different transform
// params (e.g. `?w=900` vs `?w=1000`) compares equal.
export function mediaKey(src: string | undefined) {
  return src?.split("?")[0] ?? ""
}

// The gallery index a cart/upsell thumbnail should reopen on: the position of its
// image within the product's gallery images. Index 0 is the non-buyable cover, so
// a match at 0 (or no match at all) falls back to 0 - the same starting point as a
// canvas/grid open.
export function galleryIndexForImage(images: string[], src: string | null | undefined) {
  if (!src) return 0
  const key = mediaKey(src)
  const idx = images.findIndex((image) => mediaKey(image) === key)
  return idx > 0 ? idx : 0
}
