import crypto from 'crypto';

export const DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

// Zoom's endpoint.url_validation challenge token. The exact format is not
// documented, so accept conservative URL-safe characters only. Excluding ':'
// is deliberate: the handler returns HMAC(secret, plainToken) for any
// unauthenticated validation request, and a printable token could otherwise
// be crafted as "v0:<ts>:<forged body>" to forge a valid event signature
// (signature-oracle). URL-safe tokens cannot contain the signature message
// separator, closing that replay path.
const MAX_PLAIN_TOKEN_LENGTH = 128;
const PLAIN_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

export function captureRawBody(req, _res, buffer) {
  req.rawBody = Buffer.from(buffer);
}

export function isValidPlainToken(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 8 || value.length > MAX_PLAIN_TOKEN_LENGTH) return false;
  return PLAIN_TOKEN_PATTERN.test(value);
}

export function buildUrlValidationResponse(plainToken, secretToken) {
  if (!secretToken) throw new Error('missing_webhook_secret_token');
  if (!isValidPlainToken(plainToken)) throw new Error('invalid_plain_token');
  const encryptedToken = crypto
    .createHmac('sha256', secretToken)
    .update(plainToken)
    .digest('hex');
  return { plainToken, encryptedToken };
}

export function verifyZoomWebhookRequest(req, secretToken, options = {}) {
  const signature = req.headers?.['x-zm-signature'];
  const timestamp = req.headers?.['x-zm-request-timestamp'];
  const configuredTolerance = Number(
    options.toleranceSeconds ?? process.env.WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS ?? DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS
  );
  const toleranceSeconds = Number.isFinite(configuredTolerance) && configuredTolerance >= 0
    ? configuredTolerance
    : DEFAULT_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;

  if (!secretToken) return { ok: false, reason: 'missing_webhook_secret_token' };
  if (!signature) return { ok: false, reason: 'missing_x_zm_signature' };
  if (!timestamp) return { ok: false, reason: 'missing_x_zm_request_timestamp' };
  if (!Buffer.isBuffer(req.rawBody)) return { ok: false, reason: 'missing_raw_body' };

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    return { ok: false, reason: 'invalid_x_zm_request_timestamp' };
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (toleranceSeconds > 0 && ageSeconds > toleranceSeconds) {
    return { ok: false, reason: 'stale_x_zm_request_timestamp', ageSeconds };
  }

  const message = `v0:${timestamp}:${req.rawBody.toString('utf8')}`;
  const expected = `v0=${crypto
    .createHmac('sha256', secretToken)
    .update(message)
    .digest('hex')}`;
  const receivedBuffer = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: 'invalid_x_zm_signature' };
  }

  return { ok: true, reason: 'verified', ageSeconds };
}

// RTMS signaling/media endpoints are Zoom-owned. Require secure ws(s) and a
// zoom.us host so a forged webhook cannot point the server elsewhere (SSRF).
export function isValidZoomStreamUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'wss:' && url.protocol !== 'ws:') return false;
  const host = url.hostname.toLowerCase();
  return host === 'zoom.us' || host.endsWith('.zoom.us');
}
