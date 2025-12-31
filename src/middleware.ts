import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (token) return true
        
        const sessionCookie = req.cookies.get('next-auth.session-token') || 
                             req.cookies.get('__Secure-next-auth.session-token')
        
        return !!sessionCookie
      },
    },
    pages: {
      signIn: '/login',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - Static assets in public folder (images, etc. - files with extensions)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|login|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|json|woff|woff2|ttf|eot)).*)',
  ],
}

