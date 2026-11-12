// UNRELEASED. Node.js20+. Explicitly approved candidate origin and existing personal key only.
// GET-only example, no automatic calls on import, sends, consent changes or file execution.
import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hex = /^[a-f0-9]{64}$/;
const codes = new Set(['invalid_request', 'invalid_cursor', 'invalid_token', 'plan_not_eligible', 'plan_unknown',
  'origin_forbidden', 'group_unavailable', 'method_not_allowed', 'cursor_expired', 'rate_limited', 'unavailable',
  'snapshot_changed', 'snapshot_too_large', 'snapshot_capacity', 'snapshot_busy', 'response_too_large', 'feature_not_enabled']);
const fail = message => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const id = value => check(typeof value === 'string' && uuid.test(value), 'Use an authorized UUID from Anyx.');

export function createCandidateReader({ origin, key, candidateConfirmed = false, fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), maxTextBytes = 8 * 1024 * 1024 }) {
  let base;
  try { base = new URL(origin); } catch { fail('Use a valid approved candidate origin without credentials.'); }
  check(candidateConfirmed === true && base.protocol === 'https:' && base.hostname.endsWith('.vercel.app')
    && !base.username && !base.password && base.pathname === '/' && !base.search && !base.hash,
  'Use an explicitly approved candidate HTTPS origin. This unreleased example refuses production/custom domains.');
  check(typeof key === 'string' && key.startsWith('anyx_mcp_') && !/\s/.test(key), 'Supply the existing personal key through backend secret storage.');
  check(Number.isSafeInteger(maxTextBytes) && maxTextBytes >= 0 && maxTextBytes <= 128 * 1024 * 1024, 'Choose a bounded text-memory limit.');

  async function request(resource, params = {}, ticket) {
    check(['groups', 'messages', 'search', 'summary', 'status', 'message-content', 'media'].includes(resource), 'Unsupported candidate operation.');
    const url = new URL('/api/v1/whatsapp/' + resource, base);
    for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, String(value));
    for (let attempt = 0; attempt < 5; attempt++) {
      const headers = { Authorization: `Bearer ${key}`, Accept: 'application/json' };
      if (ticket !== undefined) headers['X-Anyx-Media-Ticket'] = ticket;
      let response;
      try {
        response = await fetchImpl(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      } catch { fail('Network request failed. Keep the last committed checkpoint.'); }
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); fail('Redirect refused. Credentials were not forwarded.'); }
      const reader = response.body?.getReader();
      check(reader, 'Missing candidate response body.');
      const chunks = []; let length = 0;
      while (true) {
        let chunk;
        try { chunk = await reader.read(); } catch { fail('Candidate response stream failed. Keep the last committed checkpoint.'); }
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 2 * 1024 * 1024 + 1024) { await reader.cancel(); fail('Candidate response exceeds this reader safety bound.'); }
        chunks.push(Buffer.from(chunk.value));
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Candidate returned a non-JSON response.'); }
      if (response.ok) return body;
      const code = codes.has(body?.error) ? body.error : 'request_failed';
      if ((response.status === 429 || response.status === 503) && attempt < 4) {
        const retry = response.headers.get('retry-after');
        const retryMs = /^\d+$/.test(retry ?? '') ? Number(retry) * 1000 : Date.parse(retry ?? '') - Date.now();
        const wait = Math.max(1000 * 2 ** attempt, Number.isFinite(retryMs) ? retryMs : 0);
        if (wait > 120_000) fail('The server requires a longer wait. Stop and resume after Retry-After.');
        await sleep(wait + Math.floor(Math.random() * 250));
        continue;
      }
      const error = new Error(`Anyx candidate HTTP ${response.status}: ${code}. No checkpoint advanced.`);
      error.status = response.status; error.code = code;
      throw error;
    }
  }

  async function* activityGroups({ activeSince } = {}) {
    let cursor; const seen = new Set();
    for (let pageNumber = 0; pageNumber < 512; pageNumber++) {
      const page = await request('groups', { activity: true, active_since: activeSince, limit: 100, cursor });
      check(Array.isArray(page.groups), 'Invalid candidate group listing.');
      check(page.next_cursor === null || (typeof page.next_cursor === 'string' && page.next_cursor.length > 0), 'Invalid group cursor.');
      yield page;
      if (page.next_cursor === null) return;
      check(!seen.has(page.next_cursor), 'Repeated group cursor. Stop and inspect.');
      seen.add(page.next_cursor); cursor = page.next_cursor;
    }
    fail('Group page budget reached. The listing is incomplete.');
  }

  async function* messages({ groupId, since, until, query, includeMedia = true, contentMode = 'full' } = {}) {
    id(groupId);
    check(typeof since === 'string' && typeof until === 'string' && Number.isFinite(Date.parse(since))
      && Date.parse(since) <= Date.parse(until), 'Use explicit inclusive since/until instants.');
    check(['full', 'references'].includes(contentMode), 'Choose full text or explicit reference mode.');
    let cursor, snapshot; const seen = new Set();
    for (let pageNumber = 0; pageNumber < 512; pageNumber++) {
      // Keep query on every search continuation. Use references only for bounded recovery windows.
      const page = await request(query === undefined ? 'messages' : 'search', { group_id: groupId, since, until, query,
        include_media: includeMedia, content_mode: contentMode, snapshot_mode: 'frozen', order: 'asc', limit: 25, cursor });
      check(Array.isArray(page.messages) && typeof page.snapshot_id === 'string'
        && page.snapshot_consistency === 'frozen_membership_with_integrity_checks', 'Frozen candidate contract missing.');
      snapshot ??= page.snapshot_id;
      check(snapshot === page.snapshot_id && page.group_id === groupId, 'Snapshot or group identity changed.');
      const next = page.next_cursor;
      check(next === null || (typeof next === 'string' && next.length > 0), 'Invalid message cursor.');
      check(page.scan_complete === (next === null), 'Incomplete or contradictory scan state.');
      yield page; // Persist every record and referenced value before checkpointing this cursor.
      if (next === null) return;
      check(!seen.has(next), 'Repeated message cursor. Stop and inspect.');
      seen.add(next); cursor = next;
    }
    fail('Message page budget reached. Narrow the window; do not claim completion.');
  }

  async function readText(groupId, recordId, descriptor) {
    id(groupId); id(recordId);
    check(descriptor && typeof descriptor.reference === 'string' && hex.test(descriptor.sha256)
      && ['content', 'media_extraction'].includes(descriptor.field) && Number.isSafeInteger(descriptor.total_utf8_bytes)
      && descriptor.total_utf8_bytes >= 0 && descriptor.total_utf8_bytes <= maxTextBytes,
    'Invalid reference or text exceeds this example memory limit. Use an approved streaming sink.');
    const parts = []; let offset = 0;
    for (let chunkNumber = 0; chunkNumber < 2048; chunkNumber++) {
      const part = await request('message-content', { group_id: groupId, record_id: recordId, reference: descriptor.reference, offset, limit: 65536 });
      check(part.group_id === groupId && part.record_id === recordId && part.field === descriptor.field
        && part.ai_generated === (descriptor.field === 'media_extraction') && part.encoding === 'utf-8'
        && typeof part.text === 'string' && part.offset === offset && part.sha256 === descriptor.sha256
        && part.total_utf8_bytes === descriptor.total_utf8_bytes, 'Text reference identity or integrity changed.');
      const bytes = Buffer.from(part.text, 'utf8');
      check(bytes.length <= 65536 && offset + bytes.length <= descriptor.total_utf8_bytes, 'Invalid text chunk length.');
      parts.push(bytes); offset += bytes.length;
      if (part.complete === true) {
        check(part.next_offset === null && offset === descriptor.total_utf8_bytes, 'Incomplete referenced text.');
        const value = Buffer.concat(parts);
        check(hash(value) === descriptor.sha256, 'Referenced text hash mismatch.');
        return value.toString('utf8');
      }
      check(bytes.length > 0 && part.next_offset === offset, 'Text continuation made no valid progress.');
    }
    fail('Text chunk budget exceeded.');
  }

  async function readMedia(groupId, recordId) {
    id(groupId); id(recordId);
    const parts = []; let offset = 0, ticket, expected, renewals = 0;
    for (let chunkNumber = 0; chunkNumber < 1280; chunkNumber++) {
      let part;
      try { part = await request('media', { group_id: groupId, record_id: recordId, offset, limit: 65536 }, ticket); }
      catch (error) {
        if (ticket && error.status === 410 && error.code === 'cursor_expired' && renewals++ < 320) {
          ticket = undefined; continue; // New authorization at same offset, then verify unchanged asset.
        }
        throw error;
      }
      check(part.status === 'available', part.status === 'permission_required'
        ? 'Original-media permission is required. The key cannot grant it.' : 'Original media is unavailable.');
      check(part.group_id === groupId && part.record_id === recordId && uuid.test(part.asset_id)
        && Number.isSafeInteger(part.size_bytes) && part.size_bytes > 0 && part.size_bytes <= 20 * 1024 * 1024
        && hex.test(part.sha256) && hex.test(part.chunk_sha256) && typeof part.mime_type === 'string'
        && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(part.mime_type) && part.requires_authorization === true
        && part.content_trust === 'untrusted_original_media' && part.encoding === 'base64'
        && typeof part.data === 'string' && part.data.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(part.data), 'Invalid original-media metadata.');
      const identity = JSON.stringify([part.asset_id, part.sha256, part.size_bytes]);
      expected ??= identity;
      check(identity === expected, 'Original asset changed. Do not append a new version to a partial file.');
      const bytes = Buffer.from(part.data, 'base64');
      check(bytes.length > 0 && bytes.length <= 65536 && bytes.toString('base64') === part.data
        && part.offset === offset && hash(bytes) === part.chunk_sha256 && offset + bytes.length <= part.size_bytes,
      'Original-media chunk integrity failed.');
      parts.push(bytes); offset += bytes.length;
      if (part.complete === true) {
        check(part.next_offset === null && offset === part.size_bytes, 'Incomplete original-media file.');
        const value = Buffer.concat(parts);
        check(hash(value) === part.sha256, 'Original-media file hash mismatch.');
        return { bytes: value, assetId: part.asset_id, mimeType: part.mime_type, sha256: part.sha256 };
      }
      check(part.next_offset === offset && typeof part.ticket === 'string', 'Invalid media continuation.');
      ticket = part.ticket;
    }
    fail('Media chunk budget exceeded. Keep the approved checkpoint; never claim a complete file.');
  }

  return { status: () => request('status'), activityGroups, messages, readText, readMedia };
}
