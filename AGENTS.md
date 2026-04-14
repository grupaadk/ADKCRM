# AGENTS.md

## Commands

```bash
# Development
npm run dev                # Next.js + Convex in parallel
npm run dev:frontend       # Next.js only
npm run dev:backend        # Convex dev only

# Build / run
npm run build              # Production Next.js build
npm run start              # Start production server

# Lint
npm run lint               # ESLint for app + convex code
npm run lint -- --fix      # Apply auto-fixable lint changes

# Tests
npm test                   # Run full test suite once
npm run test:watch         # Watch mode

# Single test file
npm test -- convex/tests/clients.test.ts

# Single test by name pattern
npm test -- clients
```

## Test Notes

- `npm test` runs `vitest run` in `edge-runtime`
- `convex-test` is inlined in Vitest config
- Convex tests live under `convex/tests/`

## Rule Sources

- No `.cursor/rules/` files were found
- No `.cursorrules` file was found
- No `.github/copilot-instructions.md` file was found
- Convex-specific generated rules exist in `convex/_generated/ai/guidelines.md`
- Existing repo guidance also exists in `CLAUDE.md`

## Highest Priority Rules

- Always read `convex/_generated/ai/guidelines.md` before changing Convex code
- Never edit `convex/_generated/*` manually
- Keep changes minimal and localized
- Add validators to Convex functions
- Prefer indexes and search indexes over ad hoc filtering in Convex queries

## Project Structure

- `app/`: Next.js App Router routes and pages
- `components/`: shared React components
- `convex/`: schema, queries, mutations, actions, HTTP handlers, tests
- `proxy.ts`: Clerk middleware for `/admin` routes

## Architecture Notes

- Frontend uses App Router and Tailwind directly in JSX
- Clerk wraps the app in `app/layout.tsx`
- Convex auth uses `ConvexProviderWithClerk`; schema lives in `convex/schema.ts`

## TypeScript

- `strict: true` is enabled; keep typings explicit and precise
- Avoid `any`; prefer inferred types, `Record`, `Id<...>`, and `Doc<...>` when useful
- Use `import type` for type-only imports when appropriate
- Do not widen document IDs to plain `string` unless unavoidable
- Prefer `Readonly<{ ... }>` or inline typed props when that matches nearby code

## Imports

- The repo currently uses double quotes in source files; match that style
- Group imports simply and keep them stable
- Common order in existing files: framework/library imports, then local relative imports, then alias imports when they improve clarity
- Use `@/*` for cross-project imports
- Use relative imports for nearby Convex modules like `./_generated/server`

## Naming

- React components: `PascalCase.tsx`
- Convex modules: `camelCase.ts`
- Variables and functions: `camelCase`
- Shared constants: `UPPER_SNAKE_CASE`
- Convex indexes: `snake_case`, usually descriptive names like `by_status`, `by_status_and_city`, `search_clients`

## Formatting

- Prettier config is empty, so default Prettier formatting applies
- Existing files use 2-space indentation
- Existing files use semicolons
- Existing files use double quotes
- Do not reformat unrelated files just because you touch them

## React Guidelines

- Add `"use client"` only when needed
- Keep components straightforward; this repo does not lean on heavy abstraction
- Inline small prop types is acceptable
- Match existing Tailwind-heavy styling style
- Prefer simple composition over new helper layers

## Convex Guidelines

- Register public functions with `query`, `mutation`, `action`, `httpAction`
- Register private functions with `internalQuery`, `internalMutation`, `internalAction`
- Always include `args` validators
- Use `v.optional(...)` for optional fields
- Return bounded query results with `.take(...)` or pagination
- Prefer `withIndex` or `withSearchIndex` over `filter`
- Use `ctx.auth.getUserIdentity()` for server-side identity
- For auth-linked ownership logic, prefer the generated guideline in `convex/_generated/ai/guidelines.md`, which recommends `identity.tokenIdentifier`
- Preserve existing app behavior where current code uses `identity?.subject ?? "anonymous"` unless the task explicitly includes auth refactoring
- Throw `new Error(...)` for validation or illegal state transitions

## Convex Schema Patterns

- Define schema in `convex/schema.ts`
- Import schema helpers from `convex/server`
- Keep index names aligned with indexed fields
- Avoid unbounded arrays on documents for high-growth data

## Testing Guidelines

- Use `convexTest(schema)` for backend tests
- Import `api` from `convex/_generated/api`
- Authenticated test cases should use `t.withIdentity(...)`
- Follow the existing `describe` / `test` / `expect` style
- Prefer adding or updating focused tests near the changed backend module

## Environment

- `NEXT_PUBLIC_CONVEX_URL`: required frontend Convex URL
- `CLERK_JWT_ISSUER_DOMAIN`: Convex auth integration setting

## Convex Skills

Use these when working on Convex code: `convex-functions`, `convex-schema-validator`, `convex-realtime`, `convex-best-practices`, `convex-security-check`, `convex-http-actions`.

## Convex AI Rules

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
