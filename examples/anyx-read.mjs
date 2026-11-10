// Node.js 20+. Requires an eligible Anyx account with MCP access enabled.
// GET-only example. Prints returned data locally; does not implement durable sync.
import { pathToFileURL } from 'node:url';

export function createReader({ origin, key, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  const base = new URL(origin);
  if (base.origin !== 'https://anyx.dev' || base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Use only https://anyx.dev, without a path, query or credentials.');
  }
  if (!key || /\s/.test(key)) throw new Error('Set ANYX_MCP_KEY in the backend environment.');

  async function get(path, params) {
    const url = new URL(path, base);
    for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 5; attempt++) {
      let response;
      try {
        response = await fetchImpl(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        // Do not log the request object or secret-bearing headers.
        throw new Error('Network request failed. Keep the checkpoint and retry later.');
      }
      if (response.ok) return response.json();
      let body = {};
      try { body = await response.json(); } catch { /* A proxy may return a non-JSON error. */ }
      if ((response.status === 429 || response.status === 503) && attempt < 4) {
        const header = response.headers.get('retry-after');
        const retryMs = header === null ? 0 : /^\d+$/.test(header)
          ? Number(header) * 1000 : Date.parse(header) - Date.now();
        const waitMs = Math.max(1000 * 2 ** attempt, Number.isFinite(retryMs) ? retryMs : 0);
        if (waitMs > 120_000) throw new Error('The server requires a longer retry delay. Retry later, after Retry-After.');
        await sleep(waitMs + Math.floor(Math.random() * 250));
        continue;
      }
      // Restrict displayed error codes; do not echo an arbitrary response body.
      const code = typeof body.error === 'string' && /^[a-z_]{1,40}$/.test(body.error) ? body.error : 'request_failed';
      throw new Error(`Anyx HTTP ${response.status}: ${code}. No checkpoint was advanced.`);
    }
  }

  async function* pages(resource, { groupId, since } = {}) {
    if (!['groups', 'messages'].includes(resource)) throw new Error('Choose groups or messages.');
    if (resource === 'messages' && !groupId) throw new Error('Choose a group_id from the groups listing.');
    let cursor;
    const seen = new Set();
    for (let pageNumber = 0; pageNumber < 10000; pageNumber++) {
      const page = await get(`/api/v1/whatsapp/${resource}`, {
        limit: resource === 'groups' ? '100' : '25',
        group_id: resource === 'messages' ? groupId : undefined,
        since: resource === 'messages' && cursor === undefined ? since : undefined,
        cursor,
      });
      const next = page.next_cursor;
      if (next !== null && (typeof next !== 'string' || next.length === 0)) throw new Error('Invalid pagination response.');
      yield page; // In a real sync, persist records before saving this page's next_cursor.
      if (next === null) return;
      if (seen.has(next)) throw new Error('Repeated cursor. Stop and inspect the scan.');
      seen.add(next);
      cursor = next;
    }
    throw new Error('Safety page limit reached. Resume only after inspecting the scan.');
  }
  return { pages };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [, , resource, groupId, since] = process.argv;
    if (!process.env.ANYX_API_ORIGIN) throw new Error('Set ANYX_API_ORIGIN to the confirmed released backend origin.');
    const reader = createReader({ origin: process.env.ANYX_API_ORIGIN, key: process.env.ANYX_MCP_KEY });
    for await (const page of reader.pages(resource, { groupId, since })) console.log(JSON.stringify(page));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Reader failed.');
    process.exitCode = 1;
  }
}
