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
