# Spec for supabase-auth-integration

branch: claude/feature/supabase-auth-integration

## Amendments made during implementation

Four constraints in this spec did not survive contact with the code. Each was
resolved deliberately; the original text below is left in place, with these
overriding it.

1. **Inline errors are impossible as specified.** The spec demanded inline form
   errors, no client components, and no error detail in the URL. React's only
   inline mechanism is `useActionState`, a client hook — the three cannot all
   hold. **Resolved:** auth actions redirect with an *opaque code*
   (`/signin?error=invalid`), which the page maps to a message. The URL carries
   "a sign-in failed" and never an email or password. This follows the existing
   `?placed=1` precedent in `app/orders/[id]/page.tsx`, stays server-only, and
   works with JavaScript disabled. Sign-in still shows one message for both
   wrong-password and no-such-user, so the form is not an account-enumeration
   oracle.

2. **Done-item 4 was too strict.** It required an empty `components/` diff, but
   the auth forms need styled inputs and the only existing field styling is
   inline in `components/product/SearchFilters.tsx`. **Resolved:** added
   `components/ui/Field.tsx` (new file; `SearchFilters` untouched) and narrowed
   the assertion to *no modifications to existing files* under `components/`.
   `lib/data/` remains absolutely frozen.

3. **Sign-up may not produce a session.** The spec assumed it does. With email
   confirmation enabled on the project, `signUp` returns `session: null` and the
   visitor would land on a signed-out home page looking like a silent failure.
   **Resolved:** the action branches on whether a session came back — session
   means signed in, no session means a "check your email" state at
   `/signup?pending=1`. Works under either project setting. Sign-up also detects
   a duplicate address through the empty-`identities` response Supabase returns
   under confirmation, not only through the error message.

4. **`.env` was a template, not a filled-in file.** All three variable names
   were present with empty values, so the app 500'd at the proxy until they were
   populated. The "Depends on" section below should be read as *a populated*
   `.env`, and populating it is a setup precondition rather than a code change.

5. **Email confirmation is ON for this project**, confirmed by observation: a
   real sign-up returns no session and lands on `/signup?pending=1`. Amendment 3
   is therefore load-bearing, not defensive. Two consequences the spec did not
   anticipate:
   - Every sign-up sends an email, so Supabase's per-hour email cap is
     reachable in normal use — two mistyped addresses will do it. Sign-up
     failures are now mapped from Supabase's stable `error.code` (not its
     message text, which is not part of the API contract) to distinct codes:
     `exists`, `ratelimited`, `bademail`, `weak`, `failed`.
   - The seeded `*@demo.market` accounts were inserted directly via SQL and so
     never passed the signup API's address validation. Signing *up* with a
     `@demo.market` address can be rejected as invalid; signing *in* with the
     seeded ones works fine. Use a real-looking domain when testing sign-up.

## Overview

Give the application a real session. Step 03 built `auth.users`, the `profiles` table, the `handle_new_user` signup trigger and every RLS policy that keys off `auth.uid()` — but nothing in the app has ever authenticated, so all of it is inert. This step installs the Supabase client libraries, adds the `lib/supabase/` helpers, builds sign-up / sign-in / sign-out, wires session refresh so a session survives navigation and page reload, and puts a minimal buyer/seller profile shell behind it. After this step a visitor can create an account, see their display name and role in the header, visit an account page, and sign out — and an anonymous visitor can still do everything they can do today.

**This step deliberately does not touch `lib/data/`.** The screens keep reading the local seed modules, `CURRENT_SELLER_ID` stays exactly where it is, and the catalog, cart, checkout, orders and seller dashboards render from arrays as they do now. Auth is introduced *alongside* the seed layer, not through it. That is the whole point of splitting this work out: step 04's spec bundles session handling together with rewriting all five data modules against Postgres, which makes for one change where a session bug and a query bug are indistinguishable. Landing auth first means the session is provably working before any read is repointed, and the step-04 swap that follows becomes a pure data change with a session it can rely on.

The cost of that split is one honest seam: for the length of this step the signed-in identity and the seed-driven screens are two separate worlds. A user signed in as `homesafe@demo.market` will see their name in the header while `/seller` continues to list HomeSafe's listings because `CURRENT_SELLER_ID` says so, not because the session does. That coincidence is not integration and must not be described as such. This spec keeps the two worlds explicitly disconnected rather than half-joining them, because a half-join is the thing step 04 would then have to unpick.

## Depends on

- Step 03 (`.claude/specs/03-supabase-schema-and-rls.md`) — `auth.users`, `profiles`, `seller_profiles`, the `on_auth_user_created` trigger, and the `profiles_select_own` / `profiles_update_own` policies this step's reads and writes run under. Nothing here works without it.
- The seed commit (`supabase/migrations/20260813101702_seed_marketplace_demo_data.sql`, `20260813101800_backdate_demo_account_created_at.sql`) — the six `*@demo.market` accounts used to exercise sign-in, and the `auth.identities` rows that make password sign-in resolve at all.
- `lib/types/database.ts` — generated and committed in step 03. This step changes no schema, so it must **not** be regenerated.
- A populated `.env.local`. This step must recreate `.env.example`, which was deleted in commit `36c0837`, carrying **variable names only and no values**.

Steps 01 and 02 are depended on only in the sense that their screens must keep working; this step does not modify their data flow.

**Relationship to step 04.** `.claude/specs/04-supabase-data-layer-swap.md` currently claims the auth work as its own — routes `/signin`, `/signup`, `/signout`, the files `lib/supabase/server.ts`, `lib/supabase/session.ts`, `proxy.ts`, and definition-of-done items 9 through 12. This step takes all of that. Part of the work here is editing spec 04 to hand it over: strike those routes, files and checklist items from 04, and have it depend on this step. Two specs that both own the sign-in screen is worse than either ordering.

## Routes

New:

- `GET /signup` — account creation form (email, password, display name) — public
- `POST /signup` — creates the account via a Server Action — public
- `GET /signin` — email/password sign-in form — public
- `POST /signin` — establishes the session via a Server Action — public
- `POST /signout` — ends the session and redirects to `/` — logged-in
- `GET /account` — the profile shell: display name, email, role, and the sign-out control — logged-in; anonymous visitors redirect to `/signin`

`/account` is the only route in this step that requires a session, and it is new. **No existing route changes its access level.** `/cart`, `/checkout`, `/orders` and `/orders/[id]` are marked logged-in in `.claude/specs/visual-architecture.md` and will be gated in step 04, when they read per-user rows that actually need protecting; gating them now would lock every visitor out of screens whose data is still a shared module-level array, which is a regression dressed as security. State that reasoning in the code where the gate is absent, so the omission reads as deliberate.

`/sellers/[id]`, the public seller profile, remains unbuilt and is out of scope here.

`/signin`, `/signup`, `/signout` and `/account` are all divergences from `.claude/specs/visual-architecture.md`, which models auth as a supporting system with no routes of its own. Add all four to that document's screen table with their auth requirements as part of this step.

## Database changes

**None.** Every table, trigger and policy this step needs already exists. No migration is written, no migration is edited, and `lib/types/database.ts` is not regenerated.

Two schema facts constrain the implementation rather than changing it:

- `profiles` has **no insert policy**, by design — `handle_new_user()` creates the row from `raw_user_meta_data ->> 'display_name'`. So sign-up must pass the display name as user metadata at signup time. Do not attempt a client-side insert into `profiles`; it will be denied, and adding a policy to make it work is exactly the "weaken RLS to make a query work" failure.
- `profiles.role` defaults to `'buyer'` and is checked against `('buyer', 'seller')`. Nothing in this step promotes a user to seller — becoming a seller means creating a `seller_profiles` row and flipping the role, which is seller onboarding and belongs in its own step. Read the role, render it, and do not offer a control that changes it.

If implementation appears to require a schema or policy change, stop and re-read this section — the requirement is almost certainly a step-04 concern that has leaked in.

## Templates

This project has no template directory — screens are React Server Components under `app/`.

Create:

- `app/signup/page.tsx` and `app/signin/page.tsx` — the two auth forms. Single-column, centred, capped well below the page container width; a `Card` from `components/ui/` wrapping labelled inputs and a primary submit. These are the first new screens since the design system was written, so they are the main visual risk in this step: build them from `components/ui/` primitives and semantic tokens, not from fresh markup.
- `app/account/page.tsx` — the profile shell. Display name, email, role badge (`Badge` from `components/ui/`), and the sign-out form. Deliberately thin; it is a proof the session resolves server-side, not a settings screen.
- An error surface for failed credentials. Prefer rendering the message on the form page from the action's returned state over a redirect carrying a query param — the latter puts auth failure detail in the URL and in server logs.

Modify:

- `app/layout.tsx` — the header gains auth state: display name plus a sign-out form when signed in, a sign-in link when not. Header, nav and footer stay inline in this file; do not extract a `components/layout/`. Note the layout already awaits `getCartCount()`, so it is already async and already dynamic.

No component under `components/` should need modifying. A new shared auth control, if one is genuinely warranted, belongs in `components/ui/` and must follow the existing primitives' conventions.

## Files to change

- `app/layout.tsx` — read the session, render auth state in the nav. The seven-entry `navLinks` array stays as it is; seller links are not role-gated in this step, because seller screens still read the seed.
- `.claude/specs/04-supabase-data-layer-swap.md` — remove the auth routes, the `lib/supabase/` and `proxy.ts` file entries, and definition-of-done items 9–12, all now owned here; add this step to its "Depends on".
- `.claude/specs/visual-architecture.md` — add `/signup`, `/signin`, `/signout` and `/account` to the screen table.
- `CLAUDE.md` — update "Current state" and the completed-steps list. The claim "nothing in the app talks to it yet" stops being true for auth specifically and must be narrowed rather than deleted, since it stays true for all catalog and commerce data. Note the new `@supabase/*` dependencies and the existence of `lib/supabase/`.
- `package.json` / `package-lock.json` — the two new dependencies.

`lib/data/*`, `app/cart/*`, `app/checkout/*`, `app/orders/*`, `app/seller/*` and everything under `components/` are **out of scope**. Touching them is the signal that this step has drifted into step 04.

## Files to create

- `lib/supabase/server.ts` — the server client for Server Components and Server Actions, reading and writing session cookies through `@supabase/ssr`.
- `lib/supabase/session.ts` — the helpers screens call: current user, current profile (display name and role), and a "require a session or redirect" helper for `/account`. This is the module step 04 will later extend to replace `CURRENT_SELLER_ID`; design it so that extension is additive.
- `proxy.ts` — session refresh on every request, so an expiring token is renewed and the session persists across navigation and reload. **In Next.js 16 `middleware.ts` is renamed `proxy.ts`**, the exported function is `proxy` and not `middleware`, and its `nodejs` runtime is not configurable — Supabase's published guides still say middleware, and are wrong for this version. Read `node_modules/next/dist/docs/` before writing it. The Next docs are explicit that proxy is for optimistic checks only and is not an authorization mechanism: refresh the session there, gate in the route.
- `app/signup/page.tsx`, `app/signup/actions.ts`
- `app/signin/page.tsx`, `app/signin/actions.ts`
- `app/signout/actions.ts`
- `app/account/page.tsx`
- `.env.example` — recreated, **names only**: the public project URL variable, the public anon key variable. Do not add a service-role entry; nothing in this step needs one, and listing it invites someone to populate it.

`lib/supabase/client.ts` (the browser client) is deliberately **not** in this list. Nothing in the repo is a client component except `app/error.tsx`, and every form in this step is a server-rendered `<form action={...}>`. Do not add it speculatively.

## New dependencies

- `@supabase/supabase-js`
- `@supabase/ssr`

Both runtime dependencies. No test runner is added; `npm test` remains the `exit 1` stub, and nothing in this step may claim tests pass.

## Rules for implementation

- **Use CSS variables — never hardcode hex values.** Semantic token classes only (`bg-canvas`, `bg-surface`, `text-text-muted`, `border-border`, `text-link`, `text-success`, `text-error`) and the custom type scale (`text-title-lg`, `text-body-md`, `text-label-sm`, …), which bakes in its own weight and line-height — never pair it with `font-*` or `leading-*`. Tailwind v4 has no `tailwind.config.js` and none may be created. `bg-accent` stays reserved for conversion CTAs, which sign-in is not. Light mode only, no `dark:` variants. Every interactive element needs a ≥44px hit area (`h-touch`).
- **Never print, echo or commit a secret value.** Env vars are referred to by name in this spec, in `.env.example`, in `CLAUDE.md` and in any summary reported back. `.env.local` stays gitignored. Do not paste key material into chat, comments, commit messages or error output.
- **The anon key is the only key the browser may ever see.** `SUPABASE_SERVICE_ROLE_KEY` must never take a `NEXT_PUBLIC_` prefix, never be imported into a client component, and never appear in the browser bundle. This step should not need it at all.
- **No ad hoc `createClient()`.** Every Supabase call goes through `lib/supabase/`.
- **Do not change RLS.** No policy is added, dropped or loosened here. If a read is denied, the fix is the query or the session, not the policy.
- **Do not modify `lib/data/`.** The seed layer stays authoritative for catalog and commerce for the whole of this step, including `CURRENT_SELLER_ID` and `simulateLatency()`.
- **Keep it server-rendered.** Nothing becomes a client component. Every auth control is a plain `<form action={...}>`, and the flows must work with JavaScript disabled — including sign-in, sign-up, sign-out and the redirect after each. No client-side redirect-on-mount session handling.
- **Redirect after every auth mutation**, so a browser back button never replays a POST. Sign-out must clear cookies server-side, not merely drop client state.
- **Server Actions that change auth state end in `revalidatePath("/", "layout")`**, matching the existing actions — layout scope, because the header now renders auth state as well as the cart badge.
- **Route props come from the generated types** (`PageProps<"/account">`, `LayoutProps<"/">`); do not hand-write `{ params }` types.
- Strict TypeScript, no `any` — `unknown` plus narrowing. Never hand-write database types; `lib/types/database.ts` is generated and is not regenerated in this step.
- Read `node_modules/next/dist/docs/` before writing route, proxy or action code. It is authoritative over training data, and this version has renamed conventions.
- Auth failures are shown as errors from `components/ui/ErrorState` or inline form messaging — never a thrown exception reaching `app/error.tsx`. Do not distinguish "no such user" from "wrong password" in the message shown to the visitor.

## Definition of done

Build and static checks:

1. `npm run lint && npm run typecheck` pass.
2. `npm run build` succeeds and every route still reports dynamic (`ƒ`) — including the four new ones. No auth-aware page is statically prerendered.
3. `grep -rn "SUPABASE_SERVICE_ROLE" app/ lib/ components/` returns nothing.
4. `git diff --stat main -- lib/data components` is empty — no *existing* file under either path is modified (per amendment 2, `components/ui/Field.tsx` is a permitted new file) — and `grep -rn "CURRENT_SELLER_ID" lib/` still finds it. The seed layer is provably untouched.
5. `.env.example` exists and contains variable names with empty or placeholder values; no real key appears in the diff.

Sign-up, in the running dev server:

6. Submitting `/signup` with a new email, password and display name creates exactly one `auth.users` row and, via the trigger, exactly one `profiles` row — verified by querying both.
7. That new profile has `role = 'buyer'` and `display_name` matching what was typed, proving the display name travelled as user metadata rather than a blocked client insert.
8. Submitting `/signup` with an email that already exists shows a form error and creates no second row. **Not verified** — the project's hourly email cap was exhausted during testing (see amendment 5), and with confirmation enabled every attempt sends mail. The code path is mapped from `user_already_exists` / `email_exists` plus the empty-`identities` response, but it has not been exercised end to end. Re-run once the cap resets.

Sign-in, session persistence and sign-out:

9. Signing in at `/signin` as `homesafe@demo.market` redirects away from the form and shows "HomeSafe" in the header.
10. Bad credentials show an inline error, leave the visitor signed out, and put nothing about the failure in the URL.
11. The session survives a **full page reload** and navigation to `/`, `/search` and `/products/[id]` — the header still shows the display name on each.
12. The session survives a **dev server restart**, proving it lives in cookies rather than process memory. This is the specific regression the seed layer's module-level state cannot survive, and the first place in the app where state genuinely outlives the process.
13. `/signout` returns the header to a sign-in link, and afterwards `/account` redirects to `/signin` rather than rendering stale data.

Profile shell:

14. `/account` signed in as `jane@demo.market` shows her display name, her email, and a `buyer` role badge.
15. `/account` signed in as `homesafe@demo.market` shows the `seller` role badge — read from `profiles.role`, not inferred from the email or from `CURRENT_SELLER_ID`.
16. `/account` while signed out redirects to `/signin` and does not flash any profile content first.
17. No control anywhere in the UI changes a profile's role.

Anonymous parity — the local screen-data UI stays usable throughout:

18. Signed out, `/`, `/search` and `/products/premium-noise-cancelling-headphones` render exactly as they do on `main`.
19. Signed out, `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/seller`, `/seller/products` and `/seller/orders` all still render their seed-driven content — no redirect, no gate, no crash.
20. Add-to-cart, quantity change, checkout and the seller status control all still work signed out, and the header cart badge still updates.
21. The same screens render identically signed in — confirming auth was added beside the seed layer and not through it.

Accessibility and no-JS:

22. Sign-up, sign-in and sign-out all complete with JavaScript disabled in the browser.
23. Every input on both auth forms has an associated label, and the submit controls meet the 44px hit area.

Documentation:

24. `.claude/specs/visual-architecture.md` lists the four new routes with their auth requirements.
25. `.claude/specs/04-supabase-data-layer-swap.md` no longer claims the auth routes, files or checklist items, and depends on this step.
26. `CLAUDE.md` describes the new state accurately: auth is live, `lib/data/` is still the seed, and the two are not yet joined.
