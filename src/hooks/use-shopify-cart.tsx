import { useQuery } from "convex/react"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { api } from "../../convex/_generated/api"

type Money = {
  amount: string
  currencyCode: string
}

type StorefrontCartLine = {
  id: string
  quantity: number
  merchandise: {
    id: string
    title: string
    availableForSale: boolean
    image?: { url: string; altText?: string | null } | null
    selectedOptions: Array<{ name: string; value: string }>
    price: Money
    product: {
      title: string
      handle: string
    }
  }
}

type StorefrontCart = {
  id: string
  checkoutUrl: string
  totalQuantity: number
  cost: {
    subtotalAmount: Money
  }
  lines: {
    nodes: StorefrontCartLine[]
  }
}

type StorefrontUserError = {
  field?: string[] | null
  message: string
}

type StorefrontWarning = {
  message: string
}

type StorefrontResponse<T> = {
  data?: T
  errors?: Array<{ message: string }>
}

type CartContextValue = {
  cart: StorefrontCart | null
  configured: boolean
  loading: boolean
  adding: boolean
  error: string | null
  checkoutUrl: string | null
  totalQuantity: number
  subtotal: Money | null
  addVariant: (shopifyVariantId: string, quantity?: number) => Promise<StorefrontCart>
  refresh: () => Promise<void>
}

const CART_ID_STORAGE_KEY = "stryk:shopify-cart-id"

const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount {
        amount
        currencyCode
      }
    }
    lines(first: 50) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            availableForSale
            image {
              url
              altText
            }
            selectedOptions {
              name
              value
            }
            price {
              amount
              currencyCode
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
`

const CART_QUERY = `
  ${CART_FRAGMENT}
  query StrykCart($cartId: ID!) {
    cart(id: $cartId) {
      ...CartFields
    }
  }
`

const CART_CREATE_MUTATION = `
  ${CART_FRAGMENT}
  mutation StrykCartCreate($lines: [CartLineInput!]) {
    cartCreate(input: { lines: $lines }) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
      warnings {
        message
      }
    }
  }
`

const CART_LINES_ADD_MUTATION = `
  ${CART_FRAGMENT}
  mutation StrykCartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...CartFields
      }
      userErrors {
        field
        message
      }
      warnings {
        message
      }
    }
  }
`

const CartContext = createContext<CartContextValue | null>(null)

const UNCONFIGURED_CART: CartContextValue = {
  cart: null,
  configured: false,
  loading: false,
  adding: false,
  error: null,
  checkoutUrl: null,
  totalQuantity: 0,
  subtotal: null,
  addVariant: async () => {
    throw new Error("Shopify Storefront API is not configured.")
  },
  refresh: async () => {},
}

function userErrorMessage(errors: StorefrontUserError[], warnings: StorefrontWarning[] = []) {
  const messages = [...errors.map((error) => error.message), ...warnings.map((w) => w.message)]
  return messages.join(" ")
}

export function ShopifyCartProvider({ children }: { children: ReactNode }) {
  const config = useQuery(api.shopify.storefrontConfig)
  const [cart, setCart] = useState<StorefrontCart | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cartIdRef = useRef<string | null>(null)

  const configured = !!config?.isConfigured

  const request = useCallback(
    async <T,>(query: string, variables: Record<string, unknown>) => {
      if (!config?.isConfigured) {
        throw new Error("Shopify Storefront API is not configured.")
      }

      const response = await fetch(
        `https://${config.storeDomain}/api/${config.apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": config.publicAccessToken,
          },
          body: JSON.stringify({ query, variables }),
        },
      )

      const payload = (await response.json()) as StorefrontResponse<T>
      if (!response.ok) throw new Error(`Shopify Storefront request failed: ${response.status}`)
      if (payload.errors?.length) {
        throw new Error(payload.errors.map((err) => err.message).join(" "))
      }
      if (!payload.data) throw new Error("Shopify Storefront response did not include data.")
      return payload.data
    },
    [config],
  )

  const rememberCart = useCallback((nextCart: StorefrontCart) => {
    cartIdRef.current = nextCart.id
    window.localStorage.setItem(CART_ID_STORAGE_KEY, nextCart.id)
    setCart(nextCart)
  }, [])

  const refresh = useCallback(async () => {
    const cartId = cartIdRef.current ?? window.localStorage.getItem(CART_ID_STORAGE_KEY)
    if (!cartId || !configured) return

    setLoading(true)
    setError(null)
    try {
      const data = await request<{ cart: StorefrontCart | null }>(CART_QUERY, { cartId })
      if (data.cart) {
        rememberCart(data.cart)
      } else {
        cartIdRef.current = null
        window.localStorage.removeItem(CART_ID_STORAGE_KEY)
        setCart(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load cart.")
    } finally {
      setLoading(false)
    }
  }, [configured, rememberCart, request])

  useEffect(() => {
    if (!configured) return
    void refresh()
  }, [configured, refresh])

  const createCart = useCallback(
    async (shopifyVariantId: string, quantity: number) => {
      const data = await request<{
        cartCreate: {
          cart: StorefrontCart | null
          userErrors: StorefrontUserError[]
          warnings: StorefrontWarning[]
        }
      }>(CART_CREATE_MUTATION, {
        lines: [{ merchandiseId: shopifyVariantId, quantity }],
      })

      const message = userErrorMessage(data.cartCreate.userErrors, data.cartCreate.warnings)
      if (!data.cartCreate.cart || message) {
        throw new Error(message || "Shopify could not create the cart.")
      }
      rememberCart(data.cartCreate.cart)
      return data.cartCreate.cart
    },
    [rememberCart, request],
  )

  const addVariant = useCallback(
    async (shopifyVariantId: string, quantity = 1) => {
      setAdding(true)
      setError(null)
      try {
        const existingCartId = cartIdRef.current ?? window.localStorage.getItem(CART_ID_STORAGE_KEY)
        if (!existingCartId) return await createCart(shopifyVariantId, quantity)

        const data = await request<{
          cartLinesAdd: {
            cart: StorefrontCart | null
            userErrors: StorefrontUserError[]
            warnings: StorefrontWarning[]
          }
        }>(CART_LINES_ADD_MUTATION, {
          cartId: existingCartId,
          lines: [{ merchandiseId: shopifyVariantId, quantity }],
        })

        const message = userErrorMessage(data.cartLinesAdd.userErrors, data.cartLinesAdd.warnings)
        if (!data.cartLinesAdd.cart || message) {
          throw new Error(message || "Shopify could not add this item to cart.")
        }
        rememberCart(data.cartLinesAdd.cart)
        return data.cartLinesAdd.cart
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not add item to cart."
        setError(message)
        throw err
      } finally {
        setAdding(false)
      }
    },
    [createCart, rememberCart, request],
  )

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      configured,
      loading,
      adding,
      error,
      checkoutUrl: cart?.checkoutUrl ?? null,
      totalQuantity: cart?.totalQuantity ?? 0,
      subtotal: cart?.cost.subtotalAmount ?? null,
      addVariant,
      refresh,
    }),
    [addVariant, adding, cart, configured, error, loading, refresh],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useShopifyCart() {
  const context = useContext(CartContext)
  return context ?? UNCONFIGURED_CART
}
