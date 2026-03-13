import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Proxy /silicon to Railway via the existing working /api/[proxy] route
  if (pathname === '/silicon' || pathname.startsWith('/silicon/')) {
    // Replace /silicon with /api/silicon
    const proxyPath = pathname.replace(/^\/silicon/, '/api/silicon');
    const proxyUrl = new URL(proxyPath + search, request.url);
    
    console.log(`[MIDDLEWARE] Rewriting ${pathname} to ${proxyUrl.pathname}`);
    return NextResponse.rewrite(proxyUrl);
  }

  return NextResponse.next();
}

// Ensure middleware only runs for silicon
export const config = {
  matcher: ['/silicon', '/silicon/:path*'],
};
