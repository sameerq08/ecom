# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository.

## Project
Focused Amazon-style ecommerce marketplace (physical goods). Stack: Next.js (React, TypeScript) + Supabase (Auth, Postgres, RLS, Storage). See `specs/` for architecture and `SPEC.md` for product scope.

## Install / Run / Check

```bash
npm install              # install dependencies
npm run dev               # start local dev server
npm run build              # production build
npm run start               # run production build locally
npm run lint                # ESLint
npm run typecheck            # tsc --noEmit
npm test                      # test suite
```

Run `npm run lint && npm run typecheck` before considering any change complete. Run `npm test` when touching logic covered by tests.

## Important Folders

- `app/` — Next.js App Router routes (buyer + seller screens, per `specs/visual-architecture.md`)
- `components/` — shared React components
- `lib/supabase/` — Supabase client setup (browser + server clients), typed queries
- `lib/types/` — shared TypeScript types (mirrors entities in `specs/entity-architecture.md`)
- `supabase/migrations/` — SQL migrations (schema + RLS policies)
- `specs/` — architecture and scope references (read before making structural changes)

## TypeScript / React Conventions

- Strict TypeScript (`strict: true`); no `any` — use `unknown` + narrowing or proper types.
- Server Components by default; add `"use client"` only where interactivity requires it (forms, cart state, etc.).
- Colocate types with the entity they describe in `lib/types/`; do not duplicate Supabase-generated types by hand — regenerate via `supabase gen types typescript`.
- Data access goes through `lib/supabase/` helpers — no ad hoc `createClient()` calls scattered in components.
- Prefer server-side data fetching (Server Components, Route Handlers) over client-side `useEffect` fetching for initial page data.
- Functional components only; no class components.

## Environment Variables

- All env vars declared in `.env.local` (gitignored) and documented (names only, no values) in `.env.example`.
- Client-exposed vars must be prefixed `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — only ever the anon key, never the service role key.
- Server-only vars (e.g., `SUPABASE_SERVICE_ROLE_KEY`) must never carry the `NEXT_PUBLIC_` prefix and must never be imported into client components.

## Secret Handling

- Never commit `.env*` files other than `.env.example`.
- Never print secret values in logs, commit messages, or code comments.
- The Supabase service role key is used only in trusted server contexts (Route Handlers / server actions) that bypass RLS intentionally — never expose it to the browser bundle.
- If a secret is ever committed, treat it as compromised: rotate it in Supabase, then remove it from history.

## Verification Expectations

Before reporting a change complete:
1. `npm run lint` and `npm run typecheck` pass.
2. Any touched RLS policy is verified against both an authorized and unauthorized role (manual query or test).
3. For UI changes, exercise the affected flow in the running dev server (not just type/lint checks) — e.g., add-to-cart actually updates the cart badge.
4. New/changed entities are cross-checked against `specs/entity-architecture.md`; update that file if the schema diverges.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
