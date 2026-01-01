import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest } from 'next/server'

const handler = NextAuth(authOptions)

function getRequestOrigin(req: NextRequest): string | null {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return null
  const proto = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

async function handleAuth(req: NextRequest, ctx: unknown) {
  // In local dev, it's very common to have NEXTAUTH_URL set to production in the shell
  // (or inherited from some deploy tooling). That breaks OAuth by generating a prod
  // redirect_uri and also causes post-login redirects to jump to prod.
  //
  // Fix: derive the origin from the incoming request and temporarily set NEXTAUTH_URL
  // for this request.
  if (process.env.NODE_ENV !== 'production') {
    const origin = getRequestOrigin(req)
    if (origin) {
      const prev = process.env.NEXTAUTH_URL
      const prevInternal = process.env.NEXTAUTH_URL_INTERNAL
      try {
        process.env.NEXTAUTH_URL = origin
        process.env.NEXTAUTH_URL_INTERNAL = origin
        return await (handler as any)(req, ctx)
      } finally {
        process.env.NEXTAUTH_URL = prev
        process.env.NEXTAUTH_URL_INTERNAL = prevInternal
      }
    }
  }

  return await (handler as any)(req, ctx)
}

export async function GET(req: NextRequest, ctx: unknown) {
  return handleAuth(req, ctx)
}

export async function POST(req: NextRequest, ctx: unknown) {
  return handleAuth(req, ctx)
}

