# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — starts both Next.js frontend and Convex backend in parallel
- `npm run dev:frontend` — starts only Next.js dev server
- `npm run dev:backend` — starts only Convex dev sync
- `npm run build` — production build (Next.js)
- `npm run lint` — ESLint with Next.js core-web-vitals, TypeScript, and Convex plugin rules

## Architecture

Next.js 16 + Convex + Clerk app (bootstrapped from `nextjs-clerk` template).

**Frontend (Next.js App Router):**
- `app/` — Next.js pages using App Router. `page.tsx` is a client component.
- `components/` — shared React components. `ConvexClientProvider.tsx` wraps the app with `ConvexProviderWithClerk` for auth-aware real-time data.
- Styling: Tailwind CSS v4 via PostCSS plugin. Fonts: Geist Sans + Geist Mono.

**Backend (Convex):**
- `convex/schema.ts` — database schema definitions using `defineSchema`/`defineTable`.
- `convex/_generated/` — auto-generated types and API references. Never edit manually.
- `convex/auth.config.ts` — Clerk JWT auth provider config (uses `CLERK_JWT_ISSUER_DOMAIN` env var).

**Auth (Clerk):**
- `proxy.ts` — Clerk middleware protecting all `/admin` routes.
- Clerk wraps the app in `layout.tsx` via `<ClerkProvider dynamic>`.
- Convex receives auth via `ConvexProviderWithClerk` using Clerk's `useAuth` hook.

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

- `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL (required)
- Clerk keys configured via Clerk's standard env vars
- `CLERK_JWT_ISSUER_DOMAIN` — set on Convex Dashboard for auth integration
- `JOTFORM_WEBHOOK_SECRET` — shared secret for Jotform webhook validation (set on Convex Dashboard; optional in dev)

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
