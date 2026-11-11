// Talks to payment-service over HTTP.
//
// Address: PAYMENT_SERVICE_URL (never hardcoded).
// Timeout: PAYMENT_TIMEOUT_MS (3 seconds, per the plan).
//
// Every possible answer is turned into one of the PaymentResult outcomes below.
// This function never throws, so a broken payment-service can never crash booking-api.
//
// Why node:http and not fetch? We must tell two failures apart:
//   - connected, but no answer in time   → TIMEOUT (booking-api returns 504)
//   - could not even connect in time     → ERROR   (booking-api returns 502)
// When the payment-service container is stopped, Docker's DNS can take ~4 s to say
// "host not found". With fetch that would look like a timeout. node:http tells us
// whether the connection was made.
import http from 'node:http';
import https from 'node:https';
import { config } from '../config';

export interface PaymentRequest {
  bookingId: string;
  amount: number;
  cardToken: string;
}

export type PaymentResult =
  | { outcome: 'APPROVED'; paymentId: string } // 201
  | { outcome: 'DECLINED'; paymentId: string | null } // 402
  | { outcome: 'REJECTED'; message: string } // 400: request not accepted (e.g. unknown card token)
  | { outcome: 'TIMEOUT' } // connected, but no answer within the timeout
  | { outcome: 'ERROR' }; // 5xx, unreachable, or any unexpected answer

/** Turns payment-service's HTTP answer into an outcome. */
function interpret(status: number, body: any): PaymentResult {
  if (status === 201 && typeof body?.id === 'string') {
    return { outcome: 'APPROVED', paymentId: body.id };
  }
  if (status === 402) {
    return { outcome: 'DECLINED', paymentId: body?.error?.details?.payment?.id ?? null };
  }
  if (status === 400) {
    return { outcome: 'REJECTED', message: body?.error?.message ?? 'Payment request rejected' };
  }
  console.warn(`payment-service answered with unexpected status ${status}`);
  return { outcome: 'ERROR' };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function requestPayment(request: PaymentRequest): Promise<PaymentResult> {
  return new Promise((resolve) => {
    const url = new URL(`${config.paymentServiceUrl}/payments`);
    const body = JSON.stringify(request);
    const client = url.protocol === 'https:' ? https : http;
    let connected = false;
    let finished = false;

    const finish = (result: PaymentResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };

    const req = client.request(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => finish(interpret(res.statusCode ?? 0, parseJson(data))));
        res.on('error', () => finish({ outcome: 'ERROR' }));
      },
    );

    // Remember when the TCP connection is made (a reused keep-alive socket is already connected).
    req.on('socket', (socket) => {
      if (!socket.connecting) connected = true;
      else socket.once('connect', () => (connected = true));
    });

    req.on('error', (err) => {
      if (!finished) console.warn(`payment-service unreachable (booking ${request.bookingId}): ${err.message}`);
      finish({ outcome: 'ERROR' });
    });

    const timer = setTimeout(() => {
      console.warn(
        `payment-service gave no answer within ${config.paymentTimeoutMs}ms ` +
          `(booking ${request.bookingId}, connected: ${connected})`,
      );
      finish(connected ? { outcome: 'TIMEOUT' } : { outcome: 'ERROR' });
      req.destroy();
    }, config.paymentTimeoutMs);

    req.end(body);
  });
}
