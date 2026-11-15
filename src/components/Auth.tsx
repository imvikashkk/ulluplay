import AuthShell, { Hot, BrandLogo } from './AuthShell';
import AuthRedirect from './AuthRedirect';
import MobileLoginForm from './MobileLoginForm';

// /auth landing — server component; client JS is limited to the number form and the logged-in redirect
export default function AuthPage() {
  return (
    <>
      <AuthRedirect />
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
    </>
  );
}
