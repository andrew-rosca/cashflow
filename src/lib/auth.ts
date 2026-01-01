import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AppleProvider from 'next-auth/providers/apple'
import { getServerSession } from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from './db'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID || '',
      clientSecret: process.env.APPLE_SECRET || '',
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Default NextAuth behavior is based on NEXTAUTH_URL (baseUrl). If NEXTAUTH_URL
      // is accidentally set to production while running locally, sign-in will redirect
      // you to prod after auth.
      //
      // In dev/test, explicitly allow localhost callback URLs so local testing works
      // even when NEXTAUTH_URL is misconfigured.
      if (process.env.NODE_ENV !== 'production') {
        try {
          // IMPORTANT: In dev, return *relative* redirects as-is so the browser stays
          // on the current host even if NEXTAUTH_URL is misconfigured to production.
          if (url.startsWith('/')) return url

          const u = new URL(url)
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0') {
            return url
          }
        } catch {
          // fall through
        }

        // Fall back to app root on the current host
        return '/'
      }

      // Production-safe defaults:
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
    async session({ session, user }) {
      // With database sessions, user is provided
      if (session.user && user) {
        session.user.id = user.id
      }
      // If user is not provided (JWT strategy), try to get it from the session token
      else if (session.user && !session.user.id) {
        // The adapter should have already populated this, but just in case
        const userId = (session as any).userId
        if (userId) {
          session.user.id = userId
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'database',
  },
}

/**
 * Get the current user ID from the session
 * Use this in API routes to get the authenticated user's ID
 * 
 * In test mode, returns 'user-1' if no session exists (for test server compatibility)
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  if (session?.user?.id) {
    return session.user.id
  }
  
  // In test mode or when no session exists in test environment, return test user ID
  // This allows API tests to work without creating actual sessions
  // Check both NODE_ENV and a custom TEST_MODE env var (set by test server)
  if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
    // Return test user ID if no session (test server creates user-1)
    return 'user-1'
  }
  
  return null
}

