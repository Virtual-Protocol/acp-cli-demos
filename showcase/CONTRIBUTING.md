# Contributor Checklist

Before opening a PR, reproduce these steps locally:

1. Create or update `showcase/<project-slug>/showcase.json`
2. Add required artifacts and proof links under `showcase/<project-slug>/`
3. Run validation:

```bash
node scripts/validate-showcase.mjs
```

4. Open a PR with the project summary in `.github/pull_request_template.md`

## Redaction requirements

- Do not publish card numbers, CVVs, OTPs, magic links, API keys, access tokens, wallet material, or private account records.
- Prefer `hidden: true` while polishing evidence, then remove it once the public card is ready.
