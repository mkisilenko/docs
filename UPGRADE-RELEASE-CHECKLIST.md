# Coordinated MCP docs release

TLDR: These are local unreleased review artifacts. Backend rollout and public docs publication are separate approvals. Existing released pages, OpenAPI and navigation stay unchanged in this candidate.

## Scope and source

- Docs base: f9e38fe48c8d795e77184e3dd069666843e83e7c, mkisilenko/docs main observed12-11-2026 UTC.
- Backend ownership and exact candidate/migrations: coordinated by the existing MCP development thread. Pin its final commit with this docs commit in the consolidated release packet.
- No main merge, public docs release, deployment, production migration, flags, credentials or customer sends are authorized here.
- README's automatic Mintlify publishing behavior remains unchanged. Do not merge this branch to main without Michael's explicit docs-release approval.

## Requirements to review artifacts

| Requirement | Draft artifact |
| --- | --- |
| Captured activity, frozen bounds, order and recovery | developers/upgrade-candidate.mdx; candidate OpenAPI |
| Actual MCP tools, REST routes, large text and timestamps | developers/upgrade-mcp-tools.mdx; developers/upgrade-api-reference.mdx |
| Original media consent, expiry, hashes, missing states | developers/upgrade-media.mdx |
| AI client setup and honest compatibility | developers/upgrade-quickstart.mdx |
| CRM upserts, selective polling and checkpoints | developers/upgrade-crm.mdx; examples/anyx-read-candidate.mjs |
| Quotas, retries, failures and privacy | developers/upgrade-troubleshooting.mdx |
| Machine-readable and agent-readable contracts | contracts/mcp-upgrade.json; generated OpenAPI and agent-contracts/mcp-upgrade.md |
| Offline regression and generation checks | docs-contract.yml; existing+candidate reader tests; tools/upgrade-contract.test.mjs |

## Generated artifacts and limits

`tools/generate-upgrade-docs.mjs` generates the candidate OpenAPI and agent brief. `--check` fails stale output. It never modifies released `openapi/whatsapp-v1.json`. New candidate files are excluded from normal docs navigation and labeled unreleased.

Candidate OpenAPI uses `https://unreleased.invalid`, rather than an empty servers array. OpenAPI defaults empty/absent servers to `/`, which can accidentally target the documentation host. Replace the placeholder only after the actual environment and release are approved. Never send account credentials to docs.anyx.app.

The GET-only example rejects production/custom targets and requires explicit candidate confirmation. Tests inject fictional responses and perform no hosted calls. The example defaults to full text; reference mode can multiply request counts beyond a snapshot's 15-minute life. Maximum 20 MiB media needs 320 reads and ticket renewal; native AI media support is not implied.

## Admission and rollback

The backend's new admission control is ANYX_MCP_UPGRADE_MODE, default off, with cohort/open options and ANYX_MCP_UPGRADE_COHORT_USER_IDS. This is deployment guidance for release owners, not a user-facing setup step. The actual advertised tool/capability set must match admission. Existing text paths and unconditional account/auth/recheck protections remain separate.

Operational rollback stops new admission while keeping current suspension/revocation guards and Notes attribution capabilities. Source3c996267 is not security-equivalent to the upgraded source because it lacks newer in-flight authorization rechecks. Do not label it a compatible source rollback. A recovery artifact must retain current guards, current Notes profiles/checkpoints and required schema, receive exact-source review and hosted verification, then obtain Michael's approval.

Admission flags are process environment, not an instant live toggle. Vercel environment changes need a separately approved deployment. First create and verify an admission-OFF deployment of the same merged upgrade commit, preserving all new authentication, ingestion/callback guards and current Notes behavior. A separately approved cohort deployment uses that same SHA. Its verified OFF artifact can be a proposed rollback target, with approval and schema/private-asset preservation. Before that artifact exists and passes provider/runtime checks, rollback readiness is unverified. Neither old3c nor f877 is a security-equivalent recovery guarantee.

Do not drop media/snapshot records or alter pinned Notes jobs as an automatic rollback. A feature flag change, source rollback and schema rollback are different actions.

## Release gates

1. Reconcile fresh backend/docs heads and preserve unrelated changes. Record exact commits, complete diffs, independent review and test evidence.
2. Run generated/source/link/reader checks. Fresh hosted CI and Mintlify rendering remain separate from local Node tests.
3. Verify the exact approved backend environment: account/group isolation, suspension and revocation races, plan/Free policy, bounds/pagination, text references, media consent/chunks/expiry, quota visibility and safe fallback when admission is off.
4. Test each advertised native client. Keep provider identity, HTTP, SDK, client UI and CRM persistence evidence separate. Do not run paid or real-customer load tests without scope approval.
5. Obtain explicit backend migration/deployment/admission approvals through Owly. Do not publish new availability copy while backend admission is off or the intended cohort cannot use it.
6. Prepare the released reference/quickstart/OpenAPI/navigation/agent-entry promotion from these reviewed candidate artifacts. Preserve the old no-new-argument behavior and scope. Update actual servers and revision only after backend availability is proven for the intended audience.
7. Obtain explicit public docs-release approval, then verify rendered pages, `.md`/LLM exports, links and the actual published version. Changelog availability wording waits for that release.

## Known proof limits

Local tests use only fictional datasets. They do not prove native-client compatibility, production performance, authoritative live-source equality, retained historical media or a customer's CRM receipt. The complete original Claude debugging report was not located in this thread/scoped evidence; the current explicit requirements and handoff findings are the traceable coverage source. Do not silently relabel that as a full report audit.

Durable ingestion-time changefeed is deferred, rather than inferred from message-time checkpoints. Backdated extraction and artifact-only updates can leave activity unchanged; clients must upsert known IDs across fresh snapshots, use overlap and periodically reconcile the eligible window before access expires. Not all late updates/deletions are guaranteed to be emitted, and no deletion-tombstone contract exists. A changefeed needs coordinated event-time, ingestion, backfill, deletion and retention/checkpoint semantics. Physical private-object cleanup and proof of deletion remain separate lifecycle work.

Initial candidate7654340 passed 23 Node tests; the schema-corrected candidate passed 30. Snapshot-reader clarification adds a fresh-observation UPSERT regression, for 31 passing local tests. Generator drift checks pass. Released/candidate OpenAPI were validated with installed Mintlify CLI 4.0.786; recheck the exact corrected JSON before release. Mintlify's broken-links command reports 30 old assistant-route links in 21 files on both untouched f9 and the draft, with byte-identical output logs. The files exist; this does not establish that hosted links are broken. Candidate link checks pass locally. Full Mintlify rendering, public `.md`/LLM exports, hosted CI and native clients remain unrun.

MICHAEL: nothing.
