import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Clapperboard, LockKeyhole, MonitorPlay, Smartphone, Sparkles } from 'lucide-react';
import { AuthStyles, BrandLogo, FONT, Hot, INK, RED, YELLOW } from './AuthShell';
import MobileLoginForm from './MobileLoginForm';

// Landing variant B — benefit-led page: headline, what you get, how it works, then the number form.
// Same promise and same form as A; only the layout and copy order differ.

const PERKS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Clapperboard, title: 'Exclusive Originals', text: 'Web series jo sirf yahan milengi' },
  { icon: CalendarDays, title: 'Har hafte naye episodes', text: 'Library lagatar badhti rehti hai' },
  { icon: MonitorPlay, title: 'Full HD streaming', text: 'Mobile, laptop aur TV par smooth playback' },
  { icon: LockKeyhole, title: 'Safe & private', text: 'Sirf mobile number se login, koi password nahi' },
];

const STEPS = ['Mobile number daalo', 'Apna plan chuno', 'Turant dekhna shuru karo'];

export default function AuthVariantB() {
  return (
    <div className="relative min-h-[100dvh] text-white overflow-x-hidden" style={{ background: INK, fontFamily: FONT }}>
      <AuthStyles />

      {/* Warm glow instead of the poster wall — keeps attention on the copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 40% at 50% 0%, ${RED}55, transparent 70%), radial-gradient(50% 35% at 100% 100%, ${YELLOW}22, transparent 70%)`,
        }}
      />

      <main className="relative z-10 mx-auto w-full max-w-md px-4 pt-8 pb-10">
        <header className="ka-rise text-center">
          <BrandLogo />
          <p
            className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider"
            style={{ background: `${YELLOW}1f`, color: YELLOW, border: `1px solid ${YELLOW}44` }}
          >
            <Sparkles size={13} aria-hidden /> New episodes every week
          </p>
          <h1 className="mt-4 text-[30px] font-extrabold leading-tight">
            Binge-worthy <Hot>Originals</Hot>, ek tap door
          </h1>
          <p className="mt-2 text-sm font-medium text-white/70">Exclusive web series · Full HD · Kabhi bhi, kahin bhi</p>
        </header>

        <section
          className="ka-rise mt-6 rounded-3xl p-5"
          style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${YELLOW}33`, boxShadow: `0 0 60px -25px ${RED}` }}
        >
          <MobileLoginForm cta="Start Watching" />
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Aapko kya milega</h2>
          <ul className="mt-3 grid gap-2.5">
            {PERKS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-2xl p-3.5"
                style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${RED}26`, color: YELLOW }}
                >
                  <Icon size={18} strokeWidth={2.25} aria-hidden />
                </span>
                <span>
                  <span className="block text-[15px] font-bold">{title}</span>
                  <span className="block text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">3 steps mein shuru</h2>
          <ol className="mt-3 grid gap-2">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-[15px] font-semibold">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                  style={{ background: YELLOW, color: INK }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
            <Smartphone size={16} aria-hidden /> Mobile · Laptop · TV, sab par chalta hai
          </p>
        </section>

        <p className="mt-8 text-center text-xs leading-relaxed text-white/60">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="text-white underline underline-offset-2">Terms</Link> and{' '}
          <Link href="/privacy" className="text-white underline underline-offset-2">Privacy Policy</Link>. Need help?{' '}
          <Link href="/support" className="text-white underline underline-offset-2">Contact</Link>
        </p>
      </main>
    </div>
  );
}
