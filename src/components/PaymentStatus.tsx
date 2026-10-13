'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { INK, LINE, PANEL, RED, YELLOW } from '@/lib/brand';

// SabPaisa caps status checks per payment, and the watcher polls too — keep this light
const POLL_MS = 4000;
// SabPaisa can confirm a little after redirecting back — keep checking this long before showing a pending note
const MAX_WAIT_MS = 2 * 60 * 1000;

// Landing page after SabPaisa checkout. Polls /api/payment/verify until the order settles;
// leaving it is safe — the backend watcher still activates a payment confirmed later.
export default function PaymentStatusPage() {
  const params = useSearchParams();
  const txnId = params.get('txnId') ?? params.get('clientTxnId') ?? params.get('order_id') ?? '';
  const [state, setState] = useState<'waiting' | 'success' | 'failed' | 'pending'>('waiting');
  const [msg, setMsg] = useState('');
  const doneRef = useRef(false);
  const busyRef = useRef(false);

  const back = () => {
    window.location.href = '/subscription';
  };

  const verify = useCallback(async () => {
    if (doneRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txnId }),
      });
      if (res.status === 401) {
        window.location.href = '/auth';
        return;
      }
      const data = await res.json();

      if (data.success) {
        doneRef.current = true;
        localStorage.removeItem('mr_campaign');
        localStorage.removeItem('mr_meta_campaign_id');
        localStorage.removeItem('mr_meta_campaign_name');
        setState('success');
        setMsg('Payment successful! Subscription active ho gayi 🎉');
        setTimeout(() => {
          window.location.href = '/';
        }, 1800);
      } else if (data.message !== 'Payment not completed yet') {
        doneRef.current = true;
        setState('failed');
        setMsg('Payment failed ya cancel ho gaya.');
      }
    } catch {
      // Transient network error — keep polling
    } finally {
      busyRef.current = false;
    }
  }, [txnId]);

  useEffect(() => {
    if (!txnId) {
      back();
      return;
    }
    verify();
    const id = setInterval(verify, POLL_MS);
    const stop = setTimeout(() => {
      clearInterval(id);
      if (!doneRef.current) {
        setState('pending');
        setMsg('Payment abhi confirm nahi hua.');
      }
    }, MAX_WAIT_MS);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [txnId, verify]);

  if (!txnId) return <div className="k-body min-h-screen" />;

  const color = state === 'success' ? '#22c55e' : state === 'failed' ? RED : YELLOW;

  return (
    <div className="k-body min-h-[100dvh] flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-xl px-5 py-8 text-center"
        style={{ background: PANEL, border: `1px solid ${LINE}`, borderTop: `3px solid ${color}` }}
      >
        {state === 'waiting' ? (
          <>
            <div
              className="w-10 h-10 rounded-full border-[3px] mx-auto mb-4 animate-spin"
              style={{ borderColor: `${color} transparent ${color} ${color}` }}
            />
            <p className="m-0 text-white text-lg font-bold">Payment confirm ho raha hai...</p>
            <p className="m-0 mt-2 text-white/40 text-[12px]">Ye screen band mat karo</p>
          </>
        ) : (
          <>
            <div
              className="w-16 h-16 rounded-md flex items-center justify-center mx-auto mb-5"
              style={{ background: color, color: INK }}
            >
              {state === 'success' ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20,6 9,17 4,12" />
                </svg>
              ) : state === 'failed' ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <span className="k-display text-[30px] leading-none">!</span>
              )}
            </div>
            <p className="m-0 mb-1 text-white text-lg font-bold">{msg}</p>
            {state === 'success' && <p className="m-0 text-white/45 text-sm">Home page pe le ja rahe hain...</p>}
            {state === 'pending' && (
              <p className="m-0 text-white/45 text-sm">
                Paisa kat gaya hai to kuch der mein subscription apne aap active ho jayegi.
              </p>
            )}
            {state !== 'success' && (
              <button
                onClick={back}
                className="mt-5 w-full h-12 rounded-md text-[14px] font-extrabold cursor-pointer"
                style={{ background: YELLOW, color: INK, border: 0 }}
              >
                {state === 'failed' ? 'Dobara try karo' : 'Wapas jao'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
