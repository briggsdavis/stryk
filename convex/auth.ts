import { Password } from "@convex-dev/auth/providers/Password"
import { convexAuth } from "@convex-dev/auth/server"
import { ConvexError } from "convex/values"

function allowedAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email: string) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

const AdminPassword = Password({
  profile(params) {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase()
    if (!email || !allowedAdminEmails().has(email)) {
      throw new ConvexError("This email is not allowed to access admin.")
    }

    return { email }
  },
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [AdminPassword],
})
