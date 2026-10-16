import { cookies } from 'next/headers';
import AuthPage from '@/components/Auth';
import { getLandingAb, isVariant, LP_COOKIE, parseLpCookie, type Variant } from '@/lib/landingAb';

// Dynamic → served with Cache-Control: no-store, so Back from home re-requests this
// page and the proxy redirects logged-in users instead of showing a cached login screen.
// Also needed for the A/B test: each visitor gets their own variant.
export const dynamic = 'force-dynamic';

export default async function page({ searchParams }: { searchParams: Promise<{ lp?: string }> }) {
  const { lp } = await searchParams;
  const cfg = await getLandingAb();

  let variant: Variant = cfg.fallback;
  let assign: { run: number; variant: Variant } | null = null;

  // ?lp=a / ?lp=b → preview a variant (admin); not counted in the test
  if (isVariant(lp)) {
    variant = lp;
  } else if (cfg.enabled) {
    const pinned = parseLpCookie((await cookies()).get(LP_COOKIE)?.value);
    if (pinned?.run === cfg.run) {
      variant = pinned.variant;
    } else {
      variant = Math.random() * 100 < cfg.splitB ? 'b' : 'a';
      assign = { run: cfg.run, variant };
    }
  }

  return (
    <div>
      <AuthPage variant={variant} assign={assign} />
    </div>
  );
}
