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
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}

