import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  verifyZoomWebhookRequest,
  buildUrlValidationResponse,
  isValidPlainToken,
  isValidZoomStreamUrl,
  captureRawBody
} from '../webhookSecurity.js';
import { sanitizeFileName } from '../tool.js';
import { convertMeetingMedia } from '../convertMeetingMedia.js';

const SECRET = 'test-secret';
const signedReq = (rawBody, ts = Math.floor(Date.now() / 1000)) => {
  const sig = 'v0=' + crypto.createHmac('sha256', SECRET).update(`v0:${ts}:${rawBody}`).digest('hex');
  return {
    headers: { 'x-zm-signature': sig, 'x-zm-request-timestamp': String(ts) },
    rawBody: Buffer.from(rawBody)
  };
};

test('verifyZoomWebhookRequest accepts a valid signature', () => {
  const body = JSON.stringify({ event: 'meeting.rtms_stopped', payload: {} });
  const res = verifyZoomWebhookRequest(signedReq(body), SECRET);
  assert.equal(res.ok, true);
});

test('verifyZoomWebhookRequest rejects tampered bodies and bad signatures', () => {
  const body = JSON.stringify({ event: 'meeting.rtms_stopped', payload: {} });
  const req = signedReq(body);
  req.rawBody = Buffer.from(JSON.stringify({ event: 'meeting.rtms_started', payload: {} }));
  assert.equal(verifyZoomWebhookRequest(req, SECRET).ok, false);

  const bad = signedReq(body);
  bad.headers['x-zm-signature'] = 'v0=' + '0'.repeat(64);
  assert.equal(verifyZoomWebhookRequest(bad, SECRET).ok, false);

  const stale = signedReq(body, Math.floor(Date.now() / 1000) - 4000);
  assert.equal(verifyZoomWebhookRequest(stale, SECRET).ok, false);

  assert.equal(verifyZoomWebhookRequest(signedReq(body), '').ok, false);
});

test('plainToken validation is strict enough to prevent the signature oracle', () => {
  assert.equal(isValidPlainToken('Abc123_-~.token'), true);
  // colon would allow "v0:ts:body" signature forgery via the validation endpoint
  assert.equal(isValidPlainToken('v0:123:{bad'), false);
  assert.equal(isValidPlainToken(''), false);
  assert.equal(isValidPlainToken('x'.repeat(129)), false);
  assert.equal(isValidPlainToken(42), false);
  assert.throws(() => buildUrlValidationResponse('v0:123:x', 's'));
  assert.doesNotThrow(() => buildUrlValidationResponse('validToken123', 's'));
});

test('server_urls must be a secure Zoom websocket (SSRF guard)', () => {
  assert.equal(isValidZoomStreamUrl('wss://us02web.zoom.us/path'), true);
  assert.equal(isValidZoomStreamUrl('ws://zoom.us/x'), true);
  assert.equal(isValidZoomStreamUrl('http://zoom.us'), false);
  assert.equal(isValidZoomStreamUrl('wss://evil.example.com'), false);
  assert.equal(isValidZoomStreamUrl('wss://zoom.us.evil.com'), false);
  assert.equal(isValidZoomStreamUrl('not a url'), false);
  assert.equal(isValidZoomStreamUrl(undefined), false);
});

test('sanitizeFileName strips shell metacharacters and traversal', () => {
  assert.equal(sanitizeFileName('x`touch CANARY`'), 'x_touch_CANARY');
  assert.equal(sanitizeFileName('$(id)'), 'id');
  assert.equal(sanitizeFileName('../../etc/passwd'), '.._.._etc_passwd'); // slashes -> _
  assert.equal(sanitizeFileName('a b:c'), 'a_b_c');
  assert.equal(sanitizeFileName(''), 'unnamed');
  assert.equal(sanitizeFileName(undefined), 'unnamed');
  const long = sanitizeFileName('k'.repeat(300));
    assert.ok(long.length <= 128);
});

test('captureRawBody stores a Buffer copy', () => {
  const req = {};
  captureRawBody(req, null, Buffer.from('hello'));
  assert.ok(Buffer.isBuffer(req.rawBody));
  assert.equal(req.rawBody.toString(), 'hello');
});

test('end-to-end: convertMeetingMedia with hostile stream id is injection-free', { timeout: 30000 }, async () => {
  const run = promisify(execFile);
  // hostile id: shell substitution + traversal in the raw value
  const rawId = 'x`touch CANARY_E2E`$(id)';
  const safe = sanitizeFileName(rawId);
  const dir = path.join('recordings', safe);
  fs.mkdirSync(dir, { recursive: true });
  // 20ms of silence at 16kHz mono s16le
  fs.writeFileSync(path.join(dir, 'a.raw'), Buffer.alloc(320));
  fs.rmSync('CANARY_E2E', { force: true });

  await convertMeetingMedia(rawId);

  assert.ok(fs.existsSync(path.join(dir, 'a.wav')), 'wav should be created');
  assert.equal(fs.existsSync('CANARY_E2E'), false, 'no shell execution expected with execFile');
  assert.ok(fs.existsSync(dir), 'folder derived from sanitized id');
});
