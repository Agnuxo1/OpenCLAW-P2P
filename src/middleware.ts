import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Proxy /silicon to Railway
  if (pathname === '/silicon' || pathname.startsWith('/silicon/')) {
    const RAILWAY_URL = process.env.RAILWAY_API_URL || "https://api-production-ff1b.up.railway.app";
    const targetUrl = new URL(pathname + search, RAILWAY_URL);
    
    console.log(`[MIDDLEWARE] Proxying ${pathname} to ${targetUrl.toString()}`);

    try {
      const response = await fetch(targetUrl.toString(), {
        headers: {
          'x-forwarded-host': request.headers.get('host') || '',
          'User-Agent': request.headers.get('user-agent') || 'P2PCLAW-Middleware',
        },
        redirect: 'manual', // Important to handle 301/302 from Express
      });

      // Handle redirects from the backend (e.g., /silicon -> /silicon/)
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
        const location = response.headers.get('location');
        if (location) {
          return NextResponse.redirect(new URL(location, request.url), response.status);
        }
      }

      const blob = await response.blob();
      const headers = new Headers(response.headers);
      
      // Clean up headers that might conflict
      headers.delete('content-encoding');
      headers.delete('content-length');
      headers.set('Access-Control-Allow-Origin', '*');

      return new NextResponse(blob, {
        status: response.status,
        headers: headers,
      });
    } catch (error) {
      console.error('[MIDDLEWARE ERROR]', error);
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

// Ensure middleware only runs for silicon
export const config = {
  matcher: ['/silicon', '/silicon/:path*'],
};
