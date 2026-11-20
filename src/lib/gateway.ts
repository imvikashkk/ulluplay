// Which payment gateway new orders go to: PAYMENT_GATEWAY=sabpaisa (default) | payu | paytm — read at boot, restart after changing.
// Existing orders keep the gateway they were created with (payments.gateway_response->>'gateway'),
// so switching never strands an order that is still being paid.
export type Gateway = 'sabpaisa' | 'payu' | 'paytm';

export const GATEWAYS: readonly Gateway[] = ['sabpaisa', 'payu', 'paytm'];

export function activeGateway(): Gateway {
  return gatewayOf((process.env.PAYMENT_GATEWAY ?? '').trim().toLowerCase());
}

export function gatewayOf(v: unknown): Gateway {
  return v === 'payu' || v === 'paytm' ? v : 'sabpaisa';
}

export const GATEWAY_LABEL: Record<Gateway, string> = { sabpaisa: 'SabPaisa', payu: 'PayU', paytm: 'Paytm' };

// Normalised order status every gateway client returns
export interface GatewayOrderStatus {
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number | null;
  raw: object;
}
