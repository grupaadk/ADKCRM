# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — starts both Next.js frontend and Convex backend in parallel
- `npm run dev:frontend` — starts only Next.js dev server
- `npm run dev:backend` — starts only Convex dev sync
- `npm run build` — production build (Next.js)
- `npm run lint` — ESLint with Next.js core-web-vitals, TypeScript, and Convex plugin rules

## Architecture

Next.js 16 + Convex + Convex Auth (username + password, role-based).

**Frontend (Next.js App Router):**
- `app/` — Next.js pages using App Router. `page.tsx` is a client component.
- `app/login/page.tsx` — formularz logowania (username + password) używający `useAuthActions` z `@convex-dev/auth/react`.
- `components/` — shared React components. `ConvexClientProvider.tsx` wraps the app with `ConvexAuthNextjsProvider`.
- `components/UserMenu.tsx` — avatar z dropdownem (zmień hasło, wyloguj). Zastępuje Clerk `UserButton`.
- Styling: Tailwind CSS v4 via PostCSS plugin. Fonts: Geist Sans + Geist Mono.

**Backend (Convex):**
- `convex/schema.ts` — database schema. Spreads `...authTables` from `@convex-dev/auth/server` i rozszerza tabelę `users` o `role` (admin/sales/montaz), `isActive`, `displayName`. Pole `email` w `users` przechowuje **login** (Password provider używa go jako external account id).
- `convex/_generated/` — auto-generated types and API references. Never edit manually.
- `convex/auth.config.ts` — provider Convex Auth (domain: `CONVEX_SITE_URL`).
- `convex/auth.ts` — `convexAuth({ providers: [Password({ profile: ... })] })`. `profile()` blokuje publiczną rejestrację (`flow === "signUp"` rzuca błąd) — konta tworzy wyłącznie admin przez `createAccount` z `@convex-dev/auth/server`.
- `convex/users.ts` — moduł zarządzania userami: `me`, `list`, `create` (action, admin only), `setRole`, `setActive`, `resetPassword`, `updateProfile`, `changeOwnPassword`, `seedInitialAdmin`.
- `convex/lib/auth.ts` — helpery `getCurrentUser`, `requireUser`, `requireRole`, `userIdentifier`, `getUserIdentifier` (dla mutacji/query), `requireAuthUserIdInAction` (dla actions).
- `convex/http.ts` — `auth.addHttpRoutes(http)` montuje endpointy Convex Auth pod `/api/auth/*`.

**Auth flow:**
- `middleware.ts` — `convexAuthNextjsMiddleware()`. Niezalogowany na `/admin/*` → redirect `/login`. Zalogowany na `/login` → redirect `/admin`.
- `app/admin/layout.tsx` — `AccessGuard` sprawdza `api.users.me`. Jeśli zwraca `null` (konto nieaktywne lub bez roli) → redirect `/brak-dostepu`.
- `app/layout.tsx` — `<ConvexAuthNextjsServerProvider>` + `<ConvexAuthNextjsProvider>` w client providerze.

**Role i panel:**
- Trzy role: `admin`, `sales`, `montaz` (`USER_ROLES` w `convex/schema.ts`).
- `requireRole(ctx, "admin")` w funkcjach Convex; `roles: ["admin"]` w `NavItem` w `AdminSidebar.tsx` ukrywa linki.
- Panel zarządzania userami: `/admin/ustawienia/uzytkownicy` (admin only).
- Zmiana własnego hasła: `/admin/ustawienia/konto` (każdy zalogowany).

**Path aliases:** `@/*` maps to project root.

## Key Patterns

- Convex functions are type-safe end-to-end: schema → generated types → `api.<module>.<functionName>` in frontend.
- Use `useQuery`/`useMutation` from `convex/react` in client components for real-time reactive data.
- Use `preloadQuery` from `convex/nextjs` in server components for SSR data loading.
- `Authenticated`/`Unauthenticated` components from `convex/react` for conditional rendering based on auth state.

## Convex Skills (Superpowers)

Przy pracy z kodem Convex **zawsze używaj odpowiednich skilli** — zapewniają one zgodność z aktualnymi wzorcami i best practices Convex:

| Skill | Kiedy używać |
|-------|-------------|
| `convex` | Ogólny routing — automatycznie kieruje do szczegółowych skilli |
| `convex-functions` | Pisanie queries, mutations, actions — walidacja argumentów, obsługa błędów, `internal` functions |
| `convex-schema-validator` | Definiowanie schematów, indeksów, walidatorów, migracje schematów |
| `convex-realtime` | Subskrypcje, optimistic updates, paginacja z kursorami |
| `convex-best-practices` | Organizacja funkcji, wzorce zapytań, TypeScript, obsługa błędów |
| `convex-security-check` | Szybki audyt: autentykacja, walidacja argumentów, row-level access |
| `convex-security-audit` | Głęboki przegląd: autoryzacja, izolacja akcji, rate limiting |
| `convex-http-actions` | Webhooks (np. Jotform), endpointy HTTP, CORS, walidacja sygnatur |
| `convex-file-storage` | Upload/download plików, serwowanie URL, metadane |
| `convex-cron-jobs` | Zadania cykliczne, interwały, cron expressions, retry |
| `convex-agents` | Agenty AI z Convex Agent component — wątki, narzędzia, RAG, streaming |
| `convex-migrations` | Migracje danych: dodawanie pól, backfill, usuwanie pól, zero-downtime |
| `convex-component-authoring` | Tworzenie izolowanych komponentów Convex z eksportami |

**Użycie:** Wywołaj skill komendą `/convex-functions`, `/convex-schema-validator` itd. przed pisaniem kodu Convex.

## Environment Variables

**Frontend (.env.local):**
- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL (required)
- `NEXT_PUBLIC_CONVEX_SITE_URL` — Convex HTTP actions URL (`.site` domain)

**Convex Dashboard (env vars deployment-side):**
- `CONVEX_SITE_URL` — używane w `auth.config.ts` jako issuer domain (zwykle ustawiane automatycznie)
- `JWT_PRIVATE_KEY` + `JWKS` — klucze JWT wygenerowane przez `npx @convex-dev/auth` (nie ruszać ręcznie)
- `JOTFORM_WEBHOOK_SECRET` — shared secret for Jotform webhook validation (optional in dev)
- `ENCRYPTION_KEY` — dla `convex/lib/crypto.ts`

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
