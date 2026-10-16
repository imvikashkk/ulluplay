import AuthShell, { Hot, BrandLogo } from './AuthShell';
import AuthVariantB from './AuthVariantB';
import LandingTracker from './LandingTracker';
import MobileLoginForm from './MobileLoginForm';
import type { Variant } from '@/lib/landingAb';

// /auth landing — server component: only the chosen variant's markup is rendered and sent.
// Client JS is limited to the number form and the tracker. `assign` is set only for a visitor new to this test run.
export default function AuthPage({
  variant = 'a',
  assign = null,
}: {
  variant?: Variant;
  assign?: { run: number; variant: Variant } | null;
}) {
  return (
    <>
      <LandingTracker assign={assign} />
      {variant === 'b' ? (
        <AuthVariantB />
      ) : (
        <AuthShell>
          <div className="text-center" style={{ textShadow: '0 2px 10px rgba(0,0,0,.8)' }}>
            <BrandLogo />
            <h1 className="mt-5 text-[28px] font-extrabold leading-tight">
              <Hot>Premium</Hot> Originals, <span className="whitespace-nowrap">Made for You</span>
            </h1>
            <p className="mt-2 text-sm font-medium text-white/75">Exclusive series · Full HD · Watch anytime, anywhere</p>
          </div>

          <MobileLoginForm className="mt-6" />
        </AuthShell>
      )}
    </>
  );
}
