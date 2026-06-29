# Shopify Catalog Setup

Shopify is the source of truth for products, variants, prices, images, checkout, and collection membership. Convex stores a synced read model for the custom canvas/grid browsing UI.

This project uses two Shopify access surfaces:

- **Headless channel**: customer-facing storefront, Storefront API, cart/checkout, and sales channel attribution.
- **Dev Dashboard API-only app**: private server-side Admin API access for syncing Shopify catalog data into Convex.

Do not use legacy custom apps. Do not scaffold a Shopify CLI app unless we later need an embedded Shopify admin UI or Shopify extensions.

## 1. Set Up The Headless Channel

1. In Shopify Admin, install/open the **Headless** sales channel.
2. Add a storefront, for example `Stryk Web`.
3. Configure Storefront API permissions for the storefront:
   - read products and collections
   - cart/checkout access
   - customer account access only if/when account features are needed
4. Save the **public Storefront API access token**.

The cart uses Shopify Storefront API directly from the browser with the public token. This is intentional: Shopify public Storefront tokens are designed for browser/mobile storefronts and Shopify can rate-limit by the buyer's IP. Private Storefront tokens are for server-side requests and should include the `Shopify-Storefront-Buyer-IP` header when the request comes from buyer traffic.

## 2. Create The API-Only Sync App

Use Shopify **Dev Dashboard**, not legacy custom apps.

1. Open [Dev Dashboard](https://dev.shopify.com/dashboard/).
2. Create an app named `Stryk Catalog Sync`.
3. Choose the API-only/manual/dashboard path if offered.
4. Configure Admin API scopes:
   - `read_products`
   - `read_inventory` is not required for the current print-on-demand catalog sync
5. Release/install the app to the Shopify store.
6. In the app's **Settings**, copy:
   - Client ID
   - Client secret

With Dev Dashboard apps, Shopify does not show a permanent Admin API token. Convex uses the Client ID and Client secret to request a fresh 24-hour Admin API token whenever it runs the sync.

## 3. Set Convex Env Vars

Set these in the Convex deployment:

```text
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOPIFY_API_VERSION=2026-04
SHOPIFY_SYNC_SECRET=long-random-secret
SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN=...
```

From this repo:

```fish
bunx convex env set SHOPIFY_STORE_DOMAIN your-store.myshopify.com
bunx convex env set SHOPIFY_CLIENT_ID your-client-id
bunx convex env set SHOPIFY_CLIENT_SECRET your-client-secret
bunx convex env set SHOPIFY_API_VERSION 2026-04
bunx convex env set SHOPIFY_SYNC_SECRET long-random-secret
bunx convex env set SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN your-public-storefront-token
```

`SHOPIFY_SYNC_SECRET` protects `shopify.syncCatalogPage`, which is a public Convex action that pulls from Shopify and writes to the catalog index.

## 4. Create Product Metafields

Create product metafield definitions in Shopify Admin:

| Name                      | Namespace | Key                         | Type             |
| ------------------------- | --------- | --------------------------- | ---------------- |
| Stryk Color               | `custom`  | `stryk_color`               | Single line text |
| Stryk Category            | `custom`  | `stryk_category`            | Single line text |
| Primary Collection Handle | `custom`  | `primary_collection_handle` | Single line text |

Supported fallback keys are `custom.color` and `custom.category`, but the `stryk_*` keys are preferred.

## 5. Product Setup In Shopify

Each Shopify product should represent one matchbox/artwork family. The purchasable combinations should be Shopify variants.

Example product:

```text
Product: Nairobi Hotel Matchbox
```

Variant options:

| Option name | Example values                       | Purpose                                     |
| ----------- | ------------------------------------ | ------------------------------------------- |
| Artwork     | `Red background`, `Green background` | Which artwork/image the customer is viewing |
| Size        | `8x8`, `12x12`, `16x16`              | Print size                                  |
| Frame       | `Unframed`, `Framed`                 | Framing choice                              |

Every combination becomes a Shopify variant, for example:

```text
Red background / 8x8 / Unframed
Red background / 8x8 / Framed
Red background / 12x12 / Unframed
Green background / 8x8 / Unframed
...
```

Set variant-level price, SKU, and image where applicable. The storefront will eventually add the exact selected variant to cart.

For the Convex catalog, inventory is intentionally ignored because Stryk products are print-on-demand. A product and its variants are treated as sellable when the Shopify product is active and published. Shopify checkout can still reject a cart line if Shopify's own variant inventory settings prevent selling, so the store should use print-on-demand-compatible inventory settings in Shopify.

Cart/checkout validates the selected variant with the Shopify Storefront API. Storefront `ProductVariant.availableForSale` and the `cartLinesAdd` result are the customer-facing source of truth for purchase availability. Do not mirror Admin inventory quantity or inventory policy into the public Convex catalog unless Stryk later needs stock-aware browsing.

Media convention:

- Put the keystone/showcase image first in product media. This first image is not purchasable.
- Assign artwork-specific images to variants. Every variant sharing the same `Artwork` value should usually share that artwork image.
- The storefront resolves cart items by matching the current artwork image plus selected `Size` and `Frame` to the exact Shopify variant.

### Where To Add Options In Shopify Admin

From the Shopify product editor:

1. Open or create the product.
2. Scroll to the **Variants** section.
3. Click **Add options like size or color** or **Add variants**.
4. Add option name `Artwork`.
5. Add artwork values, such as `Red background` and `Green background`.
6. Add another option named `Size` with values `8x8`, `12x12`, `16x16`.
7. Add another option named `Frame` with values `Unframed`, `Framed`.
8. Shopify generates the variants.
9. Edit each variant row to set price, SKU, and image.

Use these exact option names where possible:

```text
Artwork
Size
Frame
```

The sync normalizes option values, so labels can be human-readable. For example `Red background` becomes the internal key `red-background`.

## 6. Product Workflow

1. Create the product in Shopify.
2. Add variant options: `Artwork`, `Size`, `Frame`.
3. Set variant prices, SKUs, and images.
4. Assign the product to one or more Shopify collections.
5. Publish it to the Headless sales channel.
6. Set `Stryk Color` and `Stryk Category`.
7. Optionally set `Primary Collection Handle` when a product belongs to multiple collections.
8. Run the Convex sync.

## 7. Run Catalog Sync

Run the first page:

```fish
bunx convex run shopify:syncCatalogPage '{"syncSecret":"long-random-secret","first":25}'
```

If the result includes `hasNextPage: true`, run again with the returned `nextCursor`:

```fish
bunx convex run shopify:syncCatalogPage '{"syncSecret":"long-random-secret","first":25,"after":"NEXT_CURSOR"}'
```

Repeat until `hasNextPage` is false.

The storefront reads paged/filterable products from Convex. Checkout should still use Shopify Storefront API through the Headless channel.

## Troubleshooting

If sync fails with:

```text
Access denied for products field.
```

the API-only app is installed but does not have Admin API product scopes granted. In the Shopify Dev Dashboard, add at least:

```text
read_products
```

Then release/update the app and reinstall it on the store with the custom distribution install link. The token can be valid while `currentAppInstallation.accessScopes` is still empty, so changing scopes in the dashboard is not enough unless the store installation is updated too.
