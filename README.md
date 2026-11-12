# Anyx docs

Source for [docs.anyx.app](https://docs.anyx.app), built with [Mintlify](https://mintlify.com).

## Rules for editing

- Every claim must match what the product does today. If a feature is not live for customers, leave it out.
- Keep wording consistent with [anyx.app](https://anyx.app). If the site and the docs disagree, fix one of them in the same week.
- No em dashes or en dashes in customer-facing copy. Use a period, comma or colon.
- Do not describe internal infrastructure, vendors or implementation details beyond what the Privacy Policy already states.
- When you move or delete a page, add a redirect in `mint.json` so old links keep working.
- Update `changelog.mdx` when a customer-visible feature ships.

## Local preview

```
npm i -g mint
mint dev
```

Open `http://localhost:3000`. Run `mint broken-links` before opening a pull request.

## Publishing

Merging to `main` deploys to production automatically through the Mintlify GitHub app. Open a pull request first.

## Unreleased MCP upgrade review

The `developers/upgrade-*` pages, `contracts/mcp-upgrade.json`, candidate OpenAPI and generated agent brief are local review artifacts. They are excluded from normal navigation and do not change the released MCP/REST contract. Do not publish them or describe new functions as live before the backend and public-docs release approvals.

The [coordinated release checklist](UPGRADE-RELEASE-CHECKLIST.md) records the promotion, admission and security-preserving rollback requirements. Candidate OpenAPI uses a reserved `.invalid` server placeholder, never the documentation host or production backend. The GET-only candidate reader requires an explicitly approved candidate target and performs no network calls on import.

Regenerate candidate artifacts with `node tools/generate-upgrade-docs.mjs`. CI uses `--check` to reject drift and runs the released/candidate reader and contract tests with fictional responses only. Response-schema fixtures reuse the MCP SDK validator through `DOCS_SCHEMA_VALIDATOR_ROOT`; CI installs that pinned SDK into an isolated temporary directory with scripts disabled. No project package/lock change, account credentials, hosted traffic or model calls are required.
