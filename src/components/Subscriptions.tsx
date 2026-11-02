'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SupportButton from './SupportButton';
import { HeaderAction, IconBack, SiteHeader } from './SiteChrome';
import { INK, LINE, PANEL, RED, YELLOW } from '@/lib/brand';
import PosterBackdrop from './PosterBackdrop';
import { Clock } from 'lucide-react';

// Ticket stamp by plan length, so it survives price changes and reordering
function badgeFor(days: number): string | null {
  if (days === 365) return 'Best value';
  if (days === 30) return 'Most popular';
  return null;
}

// Ticket order by plan length: 7 Days (₹199), 1 Month (₹299), 1 Year (₹399), 2 Days (₹169); anything else after
const ORDER = [7, 30, 365, 2];
const rank = (days: number) => (ORDER.includes(days) ? ORDER.indexOf(days) : ORDER.length);

// "₹1.1/din" — per-day cost makes the long plans' value visible next to the cheap ones
function perDay(price: number, days: number): string | null {
  if (days >= 36500) return 'Ek baar ka payment';
  const v = price / days;
  return `₹${v >= 10 ? Math.round(v) : Number(v.toFixed(1))}/din`;
}

interface ApiPlan {
  id: number;
  name: string;
  price: number;
  original_price: number;
  duration_days: number;
  description: string;
}

interface Plan extends ApiPlan {
  badge: string | null;
  duration: string;
}

function formatDuration(days: number): string {
  if (days >= 36500) return '∞ Lifetime';
  if (days >= 365) return `${Math.round(days / 365)} Year`;
  if (days >= 30)
    return `${Math.round(days / 30)} Month${Math.round(days / 30) > 1 ? 's' : ''}`;
  return `${days} Day${days > 1 ? 's' : ''}`;
}

// Small line under the day count on the ticket stub: 7 → "1 Week", 30 → "1 Month", 365 → "1 Year"
function periodLabel(days: number): string | null {
  const unit = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
  if (days % 365 === 0) return unit(days / 365, 'Year');
  if (days % 30 === 0) return unit(days / 30, 'Month');
  if (days % 7 === 0) return unit(days / 7, 'Week');
  return null;
}

// "Special offer" strip on the yearly ticket — valid till tonight 11:59 PM, ticking down every second.
// Own component so the 1s tick re-renders only this strip, not the whole page.
function OfferCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const left = Math.max(0, Math.floor((end.getTime() - now) / 1000));
  const date = new Date(end.getTime() - 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const parts: [number, string][] = [
    [Math.floor(left / 3600), 'hrs'],
    [Math.floor((left % 3600) / 60), 'min'],
    [left % 60, 'sec'],
  ];

  return (
    <div
      className="mt-2 inline-flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-md px-2 py-1.5"
      style={{ background: `linear-gradient(90deg, ${RED}2e, ${RED}0a)`, border: `1px solid ${RED}55` }}
    >
      <div className="leading-tight">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: '#ff5a6e' }}>
          <Clock size={11} strokeWidth={2.75} className="k-tick" aria-hidden /> Special offer
        </span>
        <span className="block text-[10px] text-white/55">Valid till {date}, 11:59 PM</span>
      </div>
      <div className="flex items-center gap-0.5" role="timer" aria-label="Offer ends in">
        {parts.map(([v, unit], i) => (
          <span key={unit} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[12px] font-bold text-white/40 -mt-2.5">:</span>}
            <span className="flex flex-col items-center">
              <span
                className="min-w-[24px] rounded-[4px] px-1 py-0.5 text-center text-[13px] font-extrabold leading-none tabular-nums text-white"
                style={{ background: i === 2 ? RED : 'rgba(0,0,0,.45)', border: `1px solid ${i === 2 ? RED : 'rgba(245,239,230,.12)'}` }}
              >
                {String(v).padStart(2, '0')}
              </span>
              <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/40">{unit}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Quiet saving strip on the 1 Month ticket (vs renewing the weekly plan for a month) — kept low-key so the yearly offer stays the loudest
function MonthPerks({ month, weekly }: { month: Plan; weekly: Plan | null }) {
  const saving = weekly ? Math.round((weekly.price * month.duration_days) / weekly.duration_days) - month.price : 0;
  if (saving <= 0) return null;
  return (
    <p
      className="m-0 mt-2 inline-block rounded-md px-2 py-1 text-[11px] font-semibold leading-snug text-white/65"
      style={{ background: 'rgba(245,239,230,.05)', border: '1px solid rgba(245,239,230,.12)' }}
    >
      Har hafte recharge se <span style={{ color: `${YELLOW}cc` }}>₹{saving} ki bachat</span>
    </p>
  );
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState('');
  // Came from a short plan (expired or about to) — pitch the yearly pass instead
  const [upgradeOffer, setUpgradeOffer] = useState(false);
  const userPicked = useRef(false);
  const router = useRouter();
  const sel = plans.find((p) => p.id === selected) ?? null;
  const yearly = plans.find((p) => p.duration_days === 365) ?? null;

  // Shortest plan selected → offer the next one up if it costs only a little more
  const byDays = [...plans].sort((a, b) => a.duration_days - b.duration_days);
  const nextUp =
    sel && byDays[0]?.id === sel.id && byDays[1] && byDays[1].price - sel.price <= 100 ? byDays[1] : null;

  const pick = (id: number) => {
    userPicked.current = true;
    setSelected(id);
  };

  useEffect(() => {
    if (upgradeOffer && yearly && !userPicked.current) setSelected(yearly.id);
  }, [upgradeOffer, yearly]);

  // Back from the gateway's checkout restores this page from bfcache with the button still spinning
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPaying(false);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    // Check subscription via API (cookie-based auth)
    fetch('/api/user/profile')
      .then(async (r) => {
        if (r.status === 401) {
          // Token invalid/expired — force re-login
          await fetch('/api/auth/logout', { method: 'POST' });
          localStorage.removeItem('mr_mobile');
          localStorage.removeItem('mr_pending_plan');
          window.location.href = '/auth';
          return;
        }
        const data = await r.json();
        // Subscription got activated in the background (e.g. checkout left before confirmation);
        // the response just refreshed the cookies, so go home
        if (data.success && data.subActivated) {
          localStorage.removeItem('mr_campaign');
          localStorage.removeItem('mr_meta_campaign_id');
          localStorage.removeItem('mr_meta_campaign_name');
          window.location.replace('/');
          return;
        }
        if (data.success && data.data.plan_name && data.data.sub_status === 'active') {
          setIsSubscribed(true);
        }
        if (data.success && data.data.last_plan_days && data.data.last_plan_days < 30) {
          setUpgradeOffer(true);
        }
      })
      .catch(() => setIsSubscribed(false));

    fetch('/api/plans')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const mapped: Plan[] = data.data
            .map((p: ApiPlan) => ({
              ...p,
              duration: formatDuration(p.duration_days),
              badge: badgeFor(p.duration_days),
            }))
            .sort((a: Plan, b: Plan) => rank(a.duration_days) - rank(b.duration_days));
          setPlans(mapped);
          // ?plan=year comes from the upgrade card on /profile
          if (new URLSearchParams(window.location.search).get('plan') === 'year') setUpgradeOffer(true);
          // Default to the 1 Month plan
          const def = mapped.find((p) => p.duration_days === 30) ?? mapped[0];
          setSelected(def?.id ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('mr_mobile');
    localStorage.removeItem('mr_pending_plan');
    window.location.href = '/auth';
  };

  const handlePay = async () => {
    setError('');

    if (!selected) {
      setError('Please select a plan first.');
      return;
    }

    setPaying(true);
    try {
      const getCookie = (name: string) =>
        document.cookie.split('; ').find((r) => r.startsWith(name + '='))?.split('=')[1] ?? '';

      const slug             = localStorage.getItem('mr_campaign') ?? '';
      const metaCampaignId   = localStorage.getItem('mr_meta_campaign_id') ?? '';
      const metaCampaignName = localStorage.getItem('mr_meta_campaign_name') ?? '';
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selected,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc'),
          campaignSlug: slug,
          metaCampaignId:   metaCampaignId   || null,
          metaCampaignName: metaCampaignName || null,
        }),
      });
      if (res.status === 401) {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.clear();
        window.location.href = '/auth';
        return;
      }
      const data = await res.json();
      if (data.success) {
        // Hand off to SabPaisa's hosted checkout — it returns the browser to /api/payment/callback
        window.location.href = data.data.redirectUrl;
      } else {
        setError(data.message ?? 'Payment failed. Try again.');
        setPaying(false);
      }
    } catch {
      setError('Could not start the payment. Please try again.');
      setPaying(false);
    }
  };

  return (
    <main className="k-body k-grain relative min-h-[100dvh] overflow-x-hidden pb-28">
      <style>{`
        .k-ticket { transition: border-color .2s ease; }
        .k-ticket:focus-visible { box-shadow: 0 0 0 3px rgba(250,204,21,.35); }
        @keyframes kSpin { to { transform: rotate(360deg); } }
        @keyframes kTick { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        .k-tick { animation: kTick 1s steps(2, jump-none) infinite; }
        @media (prefers-reduced-motion: reduce) { .k-tick { animation: none; } }
      `}</style>

      {/* Same backdrop as /auth, dimmed so the plan tickets stay readable */}
      <PosterBackdrop dim={0.35} />

      <SiteHeader
        right={
          <>
            {isSubscribed && (
              <HeaderAction href="/">
                <IconBack s={14} /> <span className="hidden sm:inline">Home</span>
              </HeaderAction>
            )}
            <SupportButton />
            <HeaderAction onClick={handleLogout}>Logout</HeaderAction>
          </>
        }
      />

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 pt-6 md:pt-10">
        {/* ── Header ── */}
        <div className="k-rise">
          <p className="m-0 text-[13px] font-extrabold uppercase tracking-[.25em] leading-none" style={{ color: RED }}>
            Go Premium
          </p>
          <h1 className="k-display m-0 mt-2 text-[44px] md:text-[60px] text-white">
            Choose your <span style={{ color: YELLOW }}>plan</span>
          </h1>
          <p className="m-0 mt-2 text-[13px] text-white/55">
            Unlock the full library · Watch on mobile or laptop, anywhere
          </p>
          <p className="m-0 mt-3 inline-flex items-center gap-2 text-[12px] font-semibold text-white/75">
            <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
            1 Lakh+ members abhi active hain
          </p>
        </div>

        {/* ── Upgrade offer for short-plan users ── */}
        {upgradeOffer && yearly && (
          <div
            className="k-rise mt-5 rounded-lg px-4 py-3 flex items-center gap-3"
            style={{ background: 'rgba(250,204,21,.08)', border: `1.5px dashed ${YELLOW}` }}
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[14px] font-extrabold text-white">
                {isSubscribed ? 'Upgrade karo' : 'Wapas aane ka shukriya!'} · 1 Year sirf <span style={{ color: YELLOW }}>₹{yearly.price}</span>
              </p>
              <p className="m-0 mt-0.5 text-[12px] text-white/55">
                {perDay(yearly.price, yearly.duration_days)} · baar baar recharge ka jhanjhat khatam
                {isSubscribed && ' · bache hue din jud jayenge'}
              </p>
            </div>
            {selected !== yearly.id && (
              <button
                onClick={() => pick(yearly.id)}
                className="shrink-0 h-9 px-3 rounded-md text-[12px] font-extrabold cursor-pointer"
                style={{ background: YELLOW, color: INK, border: 0 }}
              >
                Chuno
              </button>
            )}
          </div>
        )}

        {/* ── Tickets ── */}
        <div className="mt-7 flex flex-col gap-3" role="radiogroup" aria-label="Plans">
          {loading &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[92px] rounded-lg animate-pulse" style={{ background: PANEL, border: `1px solid ${LINE}` }} />
            ))}

          {!loading &&
            plans.map((plan, i) => {
              const isSel = selected === plan.id;
              const off =
                plan.original_price > plan.price
                  ? Math.round(((plan.original_price - plan.price) / plan.original_price) * 100)
                  : 0;
              return (
                <div
                  key={plan.id}
                  role="radio"
                  aria-checked={isSel}
                  tabIndex={0}
                  onClick={() => pick(plan.id)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(plan.id)}
                  className="k-ticket k-rise relative flex items-stretch rounded-lg cursor-pointer select-none outline-none"
                  style={{
                    animationDelay: `${0.05 + i * 0.06}s`,
                    background: PANEL,
                    border: `1.5px solid ${isSel ? YELLOW : LINE}`,
                  }}
                >
                  {/* Stub */}
                  <div
                    className="w-[96px] sm:w-[112px] shrink-0 flex flex-col items-center justify-center rounded-l-[7px] py-3"
                    style={{ background: isSel ? YELLOW : 'rgba(245,239,230,.04)', color: isSel ? INK : '#fff' }}
                  >
                    {plan.duration_days >= 36500 ? (
                      <>
                        <span className="k-display text-[34px] sm:text-[38px] leading-none">{plan.duration.split(' ')[0]}</span>
                        <span className="text-[10px] font-bold tracking-[.18em] uppercase mt-1 opacity-70">
                          {plan.duration.split(' ').slice(1).join(' ')}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="k-display text-[34px] sm:text-[38px] leading-none">{plan.duration_days}</span>
                        <span className="text-[10px] font-bold tracking-[.18em] uppercase mt-1 opacity-70">
                          Day{plan.duration_days > 1 ? 's' : ''}
                        </span>
                        {periodLabel(plan.duration_days) && (
                          <span className="text-[10px] font-semibold mt-0.5 opacity-55">{periodLabel(plan.duration_days)}</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Perforation */}
                  <div className="relative w-0 shrink-0" style={{ borderLeft: `2px dashed ${isSel ? INK : LINE}` }}>
                    <span className="absolute -top-[9px] -left-[9px] w-4 h-4 rounded-full" style={{ background: '#0c0809', border: `1.5px solid ${isSel ? YELLOW : LINE}`, clipPath: 'inset(50% 0 0 0)' }} />
                    <span className="absolute -bottom-[9px] -left-[9px] w-4 h-4 rounded-full" style={{ background: '#0c0809', border: `1.5px solid ${isSel ? YELLOW : LINE}`, clipPath: 'inset(0 0 50% 0)' }} />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="k-display text-[30px] leading-none" style={{ color: isSel ? YELLOW : '#fff' }}>
                          ₹{plan.price}
                        </span>
                        {off > 0 && (
                          <>
                            <span className="text-[13px] text-white/40 line-through">₹{plan.original_price}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm text-white" style={{ background: RED }}>
                              {off}% OFF
                            </span>
                          </>
                        )}
                      </div>
                      <p className="m-0 mt-1 text-[12px] font-semibold text-white/80">
                        {plan.name}
                        <span className="ml-2 font-bold" style={{ color: plan.duration_days >= 30 ? YELLOW : 'rgba(245,239,230,.45)' }}>
                          {perDay(plan.price, plan.duration_days)}
                        </span>
                      </p>
                      {plan.description && <p className="m-0 mt-0.5 text-[12px] text-white/50 leading-snug">{plan.description}</p>}
                      {plan.duration_days === 365 && <OfferCountdown />}
                      {plan.duration_days === 30 && (
                        <MonthPerks month={plan} weekly={plans.find((p) => p.duration_days === 7) ?? null} />
                      )}
                    </div>

                    {/* Radio */}
                    <span
                      className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center"
                      style={{ border: `2px solid ${isSel ? YELLOW : 'rgba(245,239,230,.25)'}` }}
                    >
                      {isSel && <span className="w-3 h-3 rounded-full" style={{ background: YELLOW }} />}
                    </span>
                  </div>

                  {/* Stamp */}
                  {plan.badge && (
                    <span
                      className="absolute -top-2.5 right-3 text-[10px] font-extrabold tracking-[.12em] uppercase px-2 py-0.5 rotate-[-3deg] pointer-events-none"
                      style={{ background: RED, color: '#fff', boxShadow: `2px 2px 0 ${INK}` }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>
              );
            })}
        </div>

        {/* Nudge off the shortest plan */}
        {sel && nextUp && (
          <div className="mt-3 rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: PANEL, border: `1.5px solid ${RED}` }}>
            <p className="m-0 min-w-0 flex-1 text-[13px] text-white/85 leading-snug">
              Sirf <b style={{ color: YELLOW }}>₹{nextUp.price - sel.price}</b> aur mein{' '}
              <b className="text-white">{nextUp.duration}</b> ka pass —{' '}
              {Math.round(nextUp.duration_days / sel.duration_days)}x zyada din
            </p>
            <button
              onClick={() => pick(nextUp.id)}
              className="shrink-0 h-9 px-3 rounded-md text-[12px] font-extrabold cursor-pointer"
              style={{ background: YELLOW, color: INK, border: 0 }}
            >
              ₹{nextUp.price} lo
            </button>
          </div>
        )}

        {/* Trust */}
        <ul className="m-0 mt-6 p-0 list-none grid grid-cols-3 gap-2 text-center">
          {['Secure payment', 'Instant access', 'No auto-debit'].map((t) => (
            <li key={t} className="text-[11px] text-white/45 px-2 py-2 rounded-md" style={{ border: `1px solid ${LINE}` }}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]" style={{ background: INK, borderTop: `1px solid ${LINE}` }}>
        <div className="mx-auto max-w-xl flex flex-col gap-1.5">
          {error && <p className="m-0 text-[12px] text-center" style={{ color: RED }}>{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-bold uppercase tracking-[.2em] text-white/40">Your plan</p>
              <p className="m-0 mt-0.5 text-[14px] font-bold text-white truncate">
                {sel ? (
                  <>
                    {sel.name} <span style={{ color: YELLOW }}>₹{sel.price}</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
            <button
              onClick={handlePay}
              disabled={paying || !sel}
              className="shrink-0 h-12 px-6 rounded-md text-[14px] font-extrabold cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
              style={{ background: YELLOW, color: INK, border: 0, boxShadow: `4px 4px 0 ${RED}` }}
            >
              {paying ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: `${INK} transparent ${INK} ${INK}`, animation: 'kSpin .8s linear infinite' }} />
                  Please wait...
                </>
              ) : (
                <>Pay ₹{sel?.price ?? ''} →</>
              )}
            </button>
          </div>
        </div>
      </div>

    </main>
  );
}
