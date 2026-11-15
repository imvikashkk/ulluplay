import { NextRequest, NextResponse } from 'next/server';
import { resolvePixelFor } from '@/lib/resolvePixel';

// ?c=<slug>                                         → that slug's pixel
// ?ad=<ad id>&adset=<adset id>&cid=<campaign id>    → for Meta ad clicks without ?c= (see resolvePixelFor)
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const r = await resolvePixelFor({ slug: sp.get('c'), adId: sp.get('ad'), adsetId: sp.get('adset'), campaignId: sp.get('cid') });
    return NextResponse.json(
      { pixelId: r.pixelId, slug: r.slug, campaignName: r.campaignName, adsetName: r.adsetName, adName: r.adName, campaignId: r.campaignId, adsetId: r.adsetId, adId: r.adId, via: r.via, mappingId: r.mappingId },
      { headers: { 'Cache-Control': 'public, max-age=60' } },
    );
  } catch {
    return NextResponse.json({ pixelId: null, slug: null, campaignName: null, adsetName: null, adName: null, campaignId: null, adsetId: null, adId: null, via: null, mappingId: null });
  }
}
