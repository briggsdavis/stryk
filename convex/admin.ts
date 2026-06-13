import { getAuthUserId } from "@convex-dev/auth/server"
import type { QueryCtx } from "./_generated/server"
import { query } from "./_generated/server"

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function requireAdmin(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    throw new Error("Not authenticated")
  }

  const user = await ctx.db.get(userId)
  const email = user?.email?.toLowerCase()
  if (!user || !email || !adminEmails().has(email)) {
    throw new Error("Unauthorized")
  }

  return {
    email,
    name: user.name ?? null,
    userId,
  }
}

export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return null
    }

    const user = await ctx.db.get(userId)
    const email = user?.email?.toLowerCase()
    if (!user || !email || !adminEmails().has(email)) {
      return null
    }

    return {
      email,
      name: user.name ?? null,
      userId,
    }
  },
})
