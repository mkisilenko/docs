import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCandidateReader } from './anyx-read-candidate.mjs';

const group = '11111111-1111-4111-8111-111111111111';
const record = '22222222-2222-4222-8222-222222222222';
const asset = '33333333-3333-4333-8333-333333333333';
const snapshot = '44444444-4444-4444-8444-444444444444';
const options = { origin: 'https://approved-fixture.vercel.app', key: 'anyx_mcp_FICTIONAL_NOT_A_REAL_KEY', candidateConfirmed: true };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const collect = async values => { const result = []; for await (const value of values) result.push(value); return result; };
const bounds = { groupId: group, since: '2026-11-12T07:00:00Z', until: '2026-11-12T08:00:00Z' };

test('candidate import/constructor does no network and refuses unapproved or production targets', () => {
  let count = 0;
  createCandidateReader({ ...options, fetchImpl: async () => { count++; } });
  assert.equal(count, 0);
  for (const change of [{ candidateConfirmed: false }, { origin: 'https://anyx.dev' }, { origin: 'https://docs.anyx.app' },
    { origin: 'http://fixture.vercel.app' }, { origin: 'https://key@fixture.vercel.app' },
    { origin: 'https://fixture.vercel.app/path' }, { origin: 'https://fixture.vercel.app/?ticket=secret' }]) {
    assert.throws(() => createCandidateReader({ ...options, ...change }));
  }
  assert.throws(() => createCandidateReader({ ...options, origin: options.key }), error => !error.message.includes(options.key));
});

test('empty activity pages still advance with original bounds, header-only credential and no redirect', async () => {
  const calls = [];
  const reader = createCandidateReader({ ...options, fetchImpl: async (url, init) => {
    calls.push({ url, init }); return reply({ groups: [], next_cursor: calls.length === 1 ? 'next-activity' : null });
  } });
  assert.equal((await collect(reader.activityGroups({ activeSince: bounds.since }))).length, 2);
  for (const call of calls) {
    assert.equal(call.init.method, 'GET'); assert.equal(call.init.redirect, 'manual');
    assert.equal(call.init.headers.Authorization, 'Bearer ' + options.key);
    assert.equal(call.url.searchParams.get('active_since'), bounds.since);
    assert.ok(!String(call.url).includes(options.key));
  }
});

test('full text is default; literal query and immutable snapshot context survive every continuation', async () => {
  const calls = [];
  const reader = createCandidateReader({ ...options, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return reply({ group_id: group, messages: [], snapshot_id: snapshot,
      snapshot_consistency: 'frozen_membership_with_integrity_checks', next_cursor: calls.length === 1 ? 'next' : null,
      scan_complete: calls.length === 2 });
  } });
  assert.equal((await collect(reader.messages({ ...bounds, query: 'Friday' }))).length, 2);
  for (const call of calls) {
    assert.equal(call.url.pathname, '/api/v1/whatsapp/search');
    assert.equal(call.url.searchParams.get('query'), 'Friday');
    assert.equal(call.url.searchParams.get('since'), bounds.since);
    assert.equal(call.url.searchParams.get('until'), bounds.until);
    assert.equal(call.url.searchParams.get('content_mode'), 'full');
  }
  const swapped = createCandidateReader({ ...options, fetchImpl: async () => reply({ group_id: group, messages: [], snapshot_id: snapshot,
    snapshot_consistency: 'frozen_membership_with_integrity_checks', next_cursor: null, scan_complete: false }) });
  await assert.rejects(collect(swapped.messages(bounds)), /Contradictory|contradictory/);
});

test('UTF8 text is reassembled and verified by bytes/hash without splitting Unicode or relabeling extraction', async () => {
  const original = 'hello 😀 שלום\n'.repeat(7000), bytes = Buffer.from(original), digest = sha(bytes);
  const descriptor = { reference: 'fictional-reference', field: 'media_extraction', sha256: digest, total_utf8_bytes: bytes.length };
  const offsets = [];
  const reader = createCandidateReader({ ...options, fetchImpl: async url => {
    const offset = Number(url.searchParams.get('offset')), limit = Number(url.searchParams.get('limit'));
    offsets.push(offset);
    let end = Math.min(bytes.length, offset + limit);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    return reply({ group_id: group, record_id: record, field: 'media_extraction', ai_generated: true,
      encoding: 'utf-8', text: bytes.subarray(offset, end).toString('utf8'), offset, next_offset: end < bytes.length ? end : null,
      complete: end === bytes.length, total_utf8_bytes: bytes.length, sha256: digest });
  } });
  assert.equal(await reader.readText(group, record, descriptor), original);
  assert.ok(offsets.length > 1); assert.equal(offsets[0], 0);
  const wrong = createCandidateReader({ ...options, fetchImpl: async () => reply({ group_id: group, record_id: record,
    field: 'media_extraction', ai_generated: false, encoding: 'utf-8', text: original, offset: 0,
    next_offset: null, complete: true, total_utf8_bytes: bytes.length, sha256: digest }) });
  await assert.rejects(wrong.readText(group, record, descriptor), /identity or integrity/);
});

function mediaChunk(bytes, offset, size = 65536, overrides = {}) {
  const part = bytes.subarray(offset, Math.min(bytes.length, offset + size)), next = offset + part.length;
  return { status: 'available', group_id: group, record_id: record, asset_id: asset, mime_type: 'image/png',
    size_bytes: bytes.length, sha256: sha(bytes), offset, next_offset: next < bytes.length ? next : null,
    complete: next === bytes.length, encoding: 'base64', data: part.toString('base64'), chunk_sha256: sha(part),
    ticket: 'fictional-ticket', expires_at: '2026-11-12T08:00:00Z', requires_authorization: true,
    content_trust: 'untrusted_original_media', ...overrides };
}

test('media renews an expired ticket at the saved offset and verifies unchanged asset before appending', async () => {
  const bytes = Buffer.alloc(150_000, 7), calls = []; let expired = false;
  const reader = createCandidateReader({ ...options, fetchImpl: async (url, init) => {
    const offset = Number(url.searchParams.get('offset')); calls.push({ url, init, offset });
    if (offset === 65536 && init.headers['X-Anyx-Media-Ticket'] && !expired) {
      expired = true; return reply({ error: 'cursor_expired' }, 410);
    }
    return reply(mediaChunk(bytes, offset));
  } });
  const result = await reader.readMedia(group, record);
  assert.deepEqual(result.bytes, bytes); assert.equal(result.sha256, sha(bytes));
  assert.deepEqual(calls.map(x => x.offset), [0, 65536, 65536, 131072]);
  assert.equal(calls[1].init.headers['X-Anyx-Media-Ticket'], 'fictional-ticket');
  assert.equal(calls[2].init.headers['X-Anyx-Media-Ticket'], undefined);
  for (const { url, init } of calls) {
    assert.equal(init.method, 'GET'); assert.equal(init.headers.Authorization, 'Bearer ' + options.key);
    assert.equal(url.searchParams.has('ticket'), false); assert.ok(!String(url).includes(options.key));
  }
});

test('changed assets, corrupt chunks and malformed base64 never produce a completed file', async () => {
  const bytes = Buffer.alloc(70_000, 4);
  for (const kind of ['asset', 'hash', 'base64']) {
    const reader = createCandidateReader({ ...options, fetchImpl: async url => {
      const offset = Number(url.searchParams.get('offset'));
      const overrides = kind === 'asset' && offset > 0 ? { asset_id: snapshot }
        : kind === 'hash' ? { chunk_sha256: '0'.repeat(64) } : kind === 'base64' ? { data: '%%%=' } : {};
      return reply(mediaChunk(bytes, offset, 65536, overrides));
    } });
    await assert.rejects(reader.readMedia(group, record));
  }
});

test('permission-required and revoked credentials stop without self-consent, secret echoes or retries', async () => {
  for (const status of [200, 401]) {
    const calls = [];
    const reader = createCandidateReader({ ...options, fetchImpl: async (url, init) => {
      calls.push({ url, init }); return status === 200 ? reply({ status: 'permission_required', reason: 'explicit_original_media_consent_required' })
        : reply({ error: 'invalid_token', debug: options.key }, 401);
    } });
    await assert.rejects(reader.readMedia(group, record), error => !error.message.includes(options.key));
    assert.equal(calls.length, 1); assert.equal(calls[0].url.pathname, '/api/v1/whatsapp/media');
    assert.equal(calls[0].init.method, 'GET');
  }
});

test('actual retry headers are honored, while long quota waits and redirects stop safely', async () => {
  let count = 0; const waits = [];
  const retrying = createCandidateReader({ ...options, sleep: async wait => waits.push(wait), fetchImpl: async () => ++count === 1
    ? reply({ error: 'rate_limited' }, 429, { 'Retry-After': '3' }) : reply({ access: 'allowed' }) });
  assert.equal((await retrying.status()).access, 'allowed'); assert.ok(waits[0] >= 3000);
  const long = createCandidateReader({ ...options, fetchImpl: async () => reply({ error: 'rate_limited' }, 429, { 'Retry-After': '3600' }) });
  await assert.rejects(long.status(), /longer wait/);
  const redirect = createCandidateReader({ ...options, fetchImpl: async () => new Response('private', { status: 307, headers: { location: 'https://elsewhere.invalid' } }) });
  await assert.rejects(redirect.status(), /Redirect refused/);
});

test('bounded body reader cancels a pathological response before JSON parsing', async () => {
  let cancelled = false;
  const reader = createCandidateReader({ ...options, fetchImpl: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1025)); },
    cancel() { cancelled = true; },
  })) });
  await assert.rejects(reader.status(), /reader safety bound/); assert.equal(cancelled, true);
});

test('upgrade admission-off is a visible nonretryable failure, not a credential problem or empty dataset', async () => {
  let count = 0;
  const reader = createCandidateReader({ ...options, fetchImpl: async () => {
    count++; return reply({ error: 'feature_not_enabled', private: options.key }, 403);
  } });
  await assert.rejects(collect(reader.messages(bounds)), error => error.code === 'feature_not_enabled'
    && error.status === 403 && !error.message.includes(options.key));
  assert.equal(count, 1);
});
