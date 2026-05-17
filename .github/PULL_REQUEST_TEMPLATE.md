## Summary

<!-- 1–3 bullets describing what changed and why. Focus on the "why". -->

-

## Test plan

<!-- Checklist of what was verified. Mark every box that actually passed. -->

- [ ] `pnpm test` — all tests pass
- [ ] `pnpm --filter @marketmind/electron type-check` — clean
- [ ] `pnpm --filter @marketmind/backend type-check` — clean
- [ ] `pnpm --filter @marketmind/electron lint` — no new errors
- [ ] Manual verification (describe below if applicable)

## Pre-commit checklist

- [ ] On a `feature/*` or `bugfix/*` branch (never `main`/`develop` directly)
- [ ] No `console.log` / debug code
- [ ] No code comments (self-documenting code + READMEs only)
- [ ] No `any` types — proper types, `unknown`, or generics
- [ ] No magic numbers — extracted to constants
- [ ] No hardcoded colors — semantic tokens only
- [ ] User-facing text internationalized (4 locales: en/pt/es/fr)
- [ ] `CHANGELOG.md` updated if user-visible
- [ ] No flaky tests introduced — touched suites re-ran twice locally

## Screenshots

<!-- For UI changes, attach before/after dark + light if applicable. -->

## Related

<!-- Linked issues, follow-ups, prior PRs. -->
