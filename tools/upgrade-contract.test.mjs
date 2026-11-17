import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const released = JSON.parse(read('openapi/whatsapp-v1.json'));
const candidate = JSON.parse(read('openapi/whatsapp-v1-candidate.json'));
const contract = JSON.parse(read('contracts/mcp-upgrade.json'));

test('released reference stays legacy, while candidate has no production server and is not in navigation', () => {
  assert.equal(released.info.version, '2026-11-10');
  assert.deepEqual(Object.keys(released.paths).sort(), ['/api/v1/whatsapp/groups', '/api/v1/whatsapp/messages']);
  assert.equal(released.paths['/api/v1/whatsapp/messages'].get.parameters.some(x => x.name === 'snapshot_mode'), false);
  assert.equal(candidate['x-release-status'], 'unreleased');
  assert.deepEqual(candidate.servers.map(x => x.url), ['https://unreleased.invalid']);
  assert.match(candidate.info.description, /UNRELEASED/);
  assert.ok(!read('docs.json').includes('upgrade-candidate'));
  assert.ok(!read('docs.json').includes('whatsapp-v1-candidate'));
});

test('candidate OpenAPI references resolve and query parameters cannot carry credentials or media tickets', () => {
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.match(value.$ref, /^#\/components\/schemas\//);
      assert.ok(candidate.components.schemas[value.$ref.slice('#/components/schemas/'.length)], value.$ref);
    }
    for (const item of Object.values(value)) visit(item);
  };
  visit(candidate);
  const operations = Object.values(candidate.paths).flatMap(item => Object.values(item));
  const operationIds = operations.map(operation => operation.operationId);
  assert.equal(new Set(operationIds).size, operationIds.length);
  for (const operation of operations) {
    for (const parameter of operation.parameters ?? []) {
      if (parameter.in === 'query') assert.ok(!/^(authorization|token|api_key|key|ticket)$/i.test(parameter.name));
    }
  }
  const media = candidate.paths['/api/v1/whatsapp/media'].get;
  assert.ok(media.parameters.some(x => x.in === 'header' && x.name === 'X-Anyx-Media-Ticket'));
});

test('references, search and original-media states are distinct and bounded', () => {
  assert.equal(candidate.paths['/api/v1/whatsapp/search'].get.parameters.find(x => x.name === 'query').required, true);
  const content = candidate.paths['/api/v1/whatsapp/message-content'].get;
  assert.equal(content.parameters.find(x => x.name === 'limit').schema.maximum, 65536);
  assert.deepEqual(candidate.components.schemas.Message.oneOf, [
    { $ref: '#/components/schemas/FullMessage' }, { $ref: '#/components/schemas/ReferencedMessage' },
  ]);
  assert.ok(!candidate.components.schemas.ReferencedMessage.required.includes('content'));
  assert.ok(candidate.components.schemas.ReferencedMessage.required.includes('content_reference'));
  assert.deepEqual(candidate.components.schemas.MediaChunk.oneOf.map(x => x.properties.status.const),
    ['permission_required', 'unavailable', 'available']);
  const available = candidate.components.schemas.MediaChunk.oneOf[2].properties;
  assert.equal(available.size_bytes.maximum, 20 * 1024 * 1024);
  assert.equal(available.requires_authorization.const, true);
  assert.ok(!Object.keys(available).some(x => /storage|bucket|phone|url/i.test(x)));
  assert.ok(candidate.components.schemas.Error.properties.error.enum.includes('response_too_large'));
});

test('generated agent contract retains all seven tools, scope, quota and no-paid-summary boundaries', () => {
  assert.deepEqual(contract.mcp.tools.map(x => x.name), ['get_status', 'list_groups', 'get_group_messages', 'search_group_messages',
    'get_group_activity_summary', 'get_message_content', 'get_group_media']);
  const brief = read('agent-contracts/mcp-upgrade.md');
  assert.match(brief, /UNRELEASED/); assert.match(brief, /complete WhatsApp history/);
  assert.match(brief, /not server-enforced key scoping/); assert.match(brief, /No customer sends/);
  assert.match(brief, /not a semantic AI narrative/i); assert.match(brief, /Retry-After/);
  for (const tool of contract.mcp.tools) assert.ok(brief.includes(tool.name));
  execFileSync(process.execPath, [path.join(root, 'tools/generate-upgrade-docs.mjs'), '--check'], { stdio: 'pipe' });
});

test('generation preserves released bytes and stale candidate output fails the check', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'anyx-doc-contract-'));
  try {
    for (const file of ['tools/generate-upgrade-docs.mjs', 'contracts/mcp-upgrade.json', 'openapi/whatsapp-v1.json']) {
      const target = path.join(temp, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, read(file));
    }
    const original = fs.readFileSync(path.join(temp, 'openapi/whatsapp-v1.json'));
    const generator = path.join(temp, 'tools/generate-upgrade-docs.mjs');
    execFileSync(process.execPath, [generator], { stdio: 'pipe' });
    assert.deepEqual(fs.readFileSync(path.join(temp, 'openapi/whatsapp-v1.json')), original);
    const agentFile = path.join(temp, 'agent-contracts/mcp-upgrade.md');
    fs.writeFileSync(agentFile, fs.readFileSync(agentFile, 'utf8').replace(/\n/g, '\r\n'));
    execFileSync(process.execPath, [generator, '--check'], { stdio: 'pipe' });
    fs.appendFileSync(path.join(temp, 'agent-contracts/mcp-upgrade.md'), '\nUnreviewed drift\n');
    assert.throws(() => execFileSync(process.execPath, [generator, '--check'], { stdio: 'pipe' }));
  } finally {
    // This known random test-owned temporary directory contains only our fixture files.
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('candidate MDX internal links resolve locally, and every candidate page says unreleased', () => {
  const files = ['upgrade-candidate', 'upgrade-troubleshooting', 'upgrade-quickstart', 'upgrade-crm', 'upgrade-media', 'upgrade-mcp-tools', 'upgrade-api-reference'];
  for (const name of files) {
    const source = read(`developers/${name}.mdx`);
    assert.match(source, /Unreleased|unreleased/);
    for (const match of source.matchAll(/\]\((\/(?!\/)[^)#?]+)(?:[?#][^)]*)?\)/g)) {
      const target = path.join(root, match[1]);
      assert.ok([target, target + '.mdx', target + '.md'].some(x => fs.existsSync(x)), match[1]);
    }
  }
});
