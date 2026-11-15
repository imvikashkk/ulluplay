import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Meta adds these to every ad click; used as a fallback when the ad URL has no ?c=
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_id', 'utm_campaign', 'utm_content', 'utm_term'];

const PUBLIC = ['/auth', '/api', '/payment', '/subscription', '/bakchod_mb', '/privacy', '/terms', '/support'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get('mr_token')?.value;
  const hasSub = req.cookies.get('mr_has_sub')?.value;
  const adminToken = req.cookies.get('mr_admin')?.value;

  // Admin routes
  if (pathname.startsWith('/bakchod_ad')) {
    if (pathname.startsWith('/bakchod_ad/login')) {
      if (adminToken) return NextResponse.redirect(new URL('/bakchod_ad', req.url));
      return NextResponse.next();
    }
    if (!adminToken) return NextResponse.redirect(new URL('/bakchod_ad/login', req.url));
    return NextResponse.next();
  }

  // Logged in users should not access auth pages
  if (token && pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Public routes — allow
  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Not logged in → auth (preserve campaign + Meta click params)
  if (!token) {
    const sp = req.nextUrl.searchParams;
    const authUrl = new URL('/auth', req.url);
    if (sp.get('c'))                  authUrl.searchParams.set('c',                  sp.get('c')!);
    if (sp.get('meta_campaign_id'))   authUrl.searchParams.set('meta_campaign_id',   sp.get('meta_campaign_id')!);
    if (sp.get('meta_campaign_name')) authUrl.searchParams.set('meta_campaign_name', sp.get('meta_campaign_name')!);
    for (const k of ['meta_adset_id', 'meta_adset_name', 'meta_ad_id', 'meta_ad_name']) {
      if (sp.get(k)) authUrl.searchParams.set(k, sp.get(k)!);
    }
    if (sp.get('fbclid'))             authUrl.searchParams.set('fbclid',             sp.get('fbclid')!);
    for (const k of UTM_KEYS) if (sp.get(k)) authUrl.searchParams.set(k, sp.get(k)!);
    return NextResponse.redirect(authUrl);
  }

  // Logged in but no subscription → subscription page (preserve campaign + Meta click params)
  if (
    hasSub !== '1' &&
    pathname !== '/subscription' &&
    !pathname.startsWith('/profile')
  ) {
    const sp = req.nextUrl.searchParams;
    const subUrl = new URL('/subscription', req.url);
    if (sp.get('c'))                  subUrl.searchParams.set('c',                  sp.get('c')!);
    if (sp.get('meta_campaign_id'))   subUrl.searchParams.set('meta_campaign_id',   sp.get('meta_campaign_id')!);
    if (sp.get('meta_campaign_name')) subUrl.searchParams.set('meta_campaign_name', sp.get('meta_campaign_name')!);
    for (const k of ['meta_adset_id', 'meta_adset_name', 'meta_ad_id', 'meta_ad_name']) {
      if (sp.get(k)) subUrl.searchParams.set(k, sp.get(k)!);
    }
    if (sp.get('fbclid'))             subUrl.searchParams.set('fbclid',             sp.get('fbclid')!);
    for (const k of UTM_KEYS) if (sp.get(k)) subUrl.searchParams.set(k, sp.get(k)!);
    return NextResponse.redirect(subUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets|upi).*)'],
};
