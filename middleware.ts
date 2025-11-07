import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Auto-detect dev or production
  const allowedOrigins = [
    'http://localhost:3000',
    'https://p2p-woad-omega.vercel.app'
  ]
  
  // Fix #1: CSP (Content Security Policy)
  // Allow scripts, styles, images, and connections from same origin and trusted sources
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  )
  
  // Fix #2: CORS (Cross-Origin Resource Sharing)
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin')
    if (origin && allowedOrigins.includes(origin)) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }
    return new NextResponse(null, { status: 403 })
  }
  
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  
  // Fix #3: Anti-Clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Fix #4: HSTS (only on production, not localhost)
  if (!request.url.includes('localhost')) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  // Fix #6: Content Type Options
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Fix #5 & #9: Remove timestamps & prevent caching for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    // Remove Date header to prevent timestamp disclosure
    response.headers.delete('Date')
  }
  
  // Fix #8: Remove server information
  response.headers.delete('X-Powered-By')
  response.headers.delete('Server')
  
  return response
}

export const config = {
  matcher: '/:path*',
}

