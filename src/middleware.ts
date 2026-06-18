import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/auth', '/alta', '/landing']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  // Allow static assets and Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check for Supabase session cookie (sb-<project>-auth-token)
  const hasSession = Array.from(req.cookies.getAll()).some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value
  )

  if (!hasSession) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
