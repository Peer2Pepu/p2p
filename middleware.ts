import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Fix: HTTP → HTTPS redirect (only in production)
  const url = request.nextUrl.clone()
  const isProduction = !request.url.includes('localhost')
  const isHttp = url.protocol === 'http:'
  
  if (isProduction && isHttp) {
    url.protocol = 'https:'
    return NextResponse.redirect(url, 301) // Permanent redirect
  }
  
  const response = NextResponse.next()
  
  // Auto-detect dev or production
  const allowedOrigins = [
    'http://localhost:3000',
    'https://p2p-woad-omega.vercel.app'
  ]
  
  // Fix #1: CSP (Content Security Policy)
  // Allow scripts, styles, images, and connections from same origin and trusted sources
  // 'unsafe-eval' is required for web3 libraries (viem, wagmi, ethers.js)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none';"
  )
  
  // Fix #2: CORS (Cross-Origin Resource Sharing) - Restricted to trusted domains
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
  
  // Fix #4: HSTS (only on production, not localhost) - with preload
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
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
  
  // Fix: Prevent caching of sensitive pages (profile, admin, stakes)
  const sensitivePages = ['/profile', '/admin', '/stakes']
  if (sensitivePages.some(page => request.nextUrl.pathname.startsWith(page))) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  
  // Fix #8: Remove server information and Vercel-specific headers
  response.headers.delete('X-Powered-By')
  response.headers.delete('Server')
  response.headers.delete('X-Vercel-Id')
  response.headers.delete('X-Vercel-Cache')
  response.headers.delete('X-Vercel-Edge-Region')
  
  // Fix: Remove any deployment error headers
  const headersToRemove = ['DEPLOYMENT_NOT_FOUND', 'X-Vercel-Error']
  headersToRemove.forEach(header => response.headers.delete(header))
  
  return response
}

export const config = {
  matcher: '/:path*',
}

