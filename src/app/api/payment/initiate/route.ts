import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { attributionVia, mappingIdOf } from '@/lib/attribution';
import { verifyUserToken } from '@/lib/userAuth';
import { createSabpaisaOrder } from '@/lib/sabpaisa';
import { createPayuOrder } from '@/lib/payu';
import { createPaytmOrder } from '@/lib/paytm';
import { activeGateway } from '@/lib/gateway';
import { APP_ENV } from '@/lib/appEnv';

export async function POST(req: NextRequest) {
  try {
    const userId = verifyUserToken(req.cookies.get('mr_token')?.value);
    if (!userId)
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 },
      );

    const body = await req.json();
    const { planId } = body;
    // _fbp/_fbc from request cookies are most reliable — fallback to body values
    let fbp: string = req.cookies.get('_fbp')?.value || body.fbp || '';
    let fbc: string = req.cookies.get('_fbc')?.value || body.fbc || '';
    let campaignSlug: string = body.campaignSlug ?? '';
    let metaCampaignId: string | null = body.metaCampaignId ?? null;
    let metaCampaignName: string | null = body.metaCampaignName ?? null;
    let metaAdsetId: string | null = body.metaAdsetId ?? null;
    let metaAdsetName: string | null = body.metaAdsetName ?? null;
    let metaAdId: string | null = body.metaAdId ?? null;
    let metaAdName: string | null = body.metaAdName ?? null;
    let attrVia: string | null = attributionVia(body.attrVia);
    let adMappingId: number | null = mappingIdOf(body.adMappingId);

    if (!planId) {
      return NextResponse.json(
        { success: false, message: 'planId required' },
        { status: 400 },
      );
    }

    const [planRes, userRes] = await Promise.all([
      pool.query(
        `SELECT id, name, price FROM plans WHERE id = $1 AND is_active = true`,
        [planId],
      ),
      pool.query(`SELECT id, mobile FROM users WHERE id = $1`, [userId]),
    ]);

    if (planRes.rows.length === 0)
      return NextResponse.json(
        { success: false, message: 'Plan not found' },
        { status: 404 },
      );
    if (userRes.rows.length === 0)
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 },
      );

    const plan = planRes.rows[0];
    const user = userRes.rows[0];

    // Fallback to stored attribution if this session has no campaign or no ad click cookies
    if ((!campaignSlug || !fbc || !fbp) && user.mobile) {
      const attrRes = await pool.query(
        `SELECT campaign_slug, meta_campaign_id, meta_campaign_name, meta_adset_id, meta_adset_name, meta_ad_id, meta_ad_name, fbp, fbc,
                attribution_via, ad_mapping_id
         FROM phone_attributions WHERE mobile = $1`,
        [user.mobile],
      );
      if (attrRes.rows.length > 0) {
        const attr = attrRes.rows[0];
        if (!campaignSlug) {
          campaignSlug = attr.campaign_slug || campaignSlug;
          metaCampaignId = attr.meta_campaign_id || metaCampaignId;
          metaCampaignName = attr.meta_campaign_name || metaCampaignName;
          metaAdsetId = attr.meta_adset_id || metaAdsetId;
          metaAdsetName = attr.meta_adset_name || metaAdsetName;
          metaAdId = attr.meta_ad_id || metaAdId;
          metaAdName = attr.meta_ad_name || metaAdName;
          attrVia = attr.attribution_via || attrVia;
          adMappingId = attr.ad_mapping_id ?? adMappingId;
        }
        if (!fbp && attr.fbp) fbp = attr.fbp;
        if (!fbc && attr.fbc) fbc = attr.fbc;
      }
    }

    const customer = { userId: Number(userId), mobile: user.mobile ?? '' };
    const gateway = activeGateway();
    const order =
      gateway === 'payu' ? await createPayuOrder(Number(plan.price), customer)
      : gateway === 'paytm' ? await createPaytmOrder(Number(plan.price), customer)
      : await createSabpaisaOrder(Number(plan.price), customer);

    if ('error' in order) {
      return NextResponse.json(
        { success: false, message: order.error },
        { status: 400 },
      );
    }

    // Our txn id doubles as SabPaisa's clientTxnId — the status page and verify route key on it
    const txnId = order.orderId;

    await pool.query(
      `INSERT INTO payments (user_id, plan_id, txn_id, amount, status, campaign_slug, cf_order_id, fbp, fbc, meta_campaign_id, meta_campaign_name, gateway_response, client_ip, user_agent,
                             meta_adset_id, meta_adset_name, meta_ad_id, meta_ad_name, attribution_via, ad_mapping_id)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        userId,
        planId,
        txnId,
        plan.price,
        campaignSlug || null,
        order.paymentId || null,
        fbp,
        fbc,
        metaCampaignId,
        metaCampaignName,
        JSON.stringify({ expiresAt: order.expiresAt, gateway, env: APP_ENV, ...('txnToken' in order ? { txnToken: order.txnToken } : {}) }),
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        req.headers.get('user-agent') || null,
        metaAdsetId,
        metaAdsetName,
        metaAdId,
        metaAdName,
        campaignSlug ? attrVia : null,
        campaignSlug ? adMappingId : null,
      ],
    );

    // The browser is redirected to the gateway's checkout (SabPaisa URL, or our PayU / Paytm form-post page)
    return NextResponse.json({
      success: true,
      data: { txnId, amount: plan.price, redirectUrl: order.redirectUrl },
    });
  } catch (err) {
    console.error('payment/initiate error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 },
    );
  }
}
