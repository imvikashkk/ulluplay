// Which payment gateway new orders go through — set PAYMENT_GATEWAY in .env (read at runtime, restart to apply).
// Each order remembers its own gateway (gateway_response.gateway), so pending orders still settle after a switch.
import { getPaytmOrderStatus } from './paytm';
import { getSabpaisaOrderStatus } from './sabpaisa';

export type Gateway = 'sabpaisa' | 'paytm';

export function activeGateway(): Gateway {
  return process.env.PAYMENT_GATEWAY?.trim().toLowerCase() === 'paytm' ? 'paytm' : 'sabpaisa';
}

// Orders created before the toggle existed carry no gateway — they were all SabPaisa
export function orderGateway(value: unknown): Gateway {
  return value === 'paytm' ? 'paytm' : 'sabpaisa';
}

export function getOrderStatus(txnId: string, gateway: Gateway) {
  return gateway === 'paytm' ? getPaytmOrderStatus(txnId) : getSabpaisaOrderStatus(txnId);
}
