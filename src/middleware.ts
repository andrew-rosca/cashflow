import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // In test mode, allow all requests (tests use API-level authentication)
        if (process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true') {
          return true
        }
        
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
     * - api (all API routes - they handle their own authentication)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - privacy (privacy policy page)
     * - terms (terms of service page)
     * - Static assets in public folder (images, etc. - files with extensions)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login|privacy|terms|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|json|woff|woff2|ttf|eot)).*)',
  ],
}

