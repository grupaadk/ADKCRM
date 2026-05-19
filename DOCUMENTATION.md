# ADK CRM - Comprehensive Documentation

## 📋 Project Overview

ADK CRM is a comprehensive customer relationship management system designed specifically for ADK Okna (window and door installation company). It replaces a fragmented system of Jotform, Trello, Notion, Google Drive, and Make.com automations with a unified web application.

**Core Purpose**: Streamline lead management, customer workflow, document generation, and file storage for window/door installation projects.

**Tech Stack**:
- **Frontend**: Next.js 16 (App Router) with Tailwind CSS
- **Backend**: Convex (serverless PostgreSQL-compatible database)
- **Authentication**: Clerk (email/password + Google SSO)
- **File Storage**: Google Drive API (OAuth integration)
- **Lead Capture**: Jotform webhooks
- **Optional Integration**: Trello (for backward compatibility)
- **Styling**: Tailwind CSS v4
- **Fonts**: Geist Sans + Geist Mono

## 🏗️ Architecture

### Frontend (Next.js App Router)
- `app/` - Next.js pages using App Router
- `app/login/page.tsx` - Login form using Clerk + Convex Auth
- `components/` - Shared React components
- `components/ConvexClientProvider.tsx` - Wraps app with Convex + Clerk providers
- `components/UserMenu.tsx` - Avatar with dropdown (change password, logout)

### Backend (Convex)
- `convex/schema.ts` - Database schema (extends auth tables with role, isActive, displayName)
- `convex/_generated/` - Auto-generated types and API references (never edit manually)
- `convex/auth.config.ts` - Convex Auth configuration (domain: CONVEX_SITE_URL)
- `convex/auth.ts` - Auth setup with Password provider (blocks public registration)
- `convex/users.ts` - User management (me, list, create, setRole, setActive, etc.)
- `convex/lib/auth.ts` - Auth helpers (getCurrentUser, requireUser, requireRole, etc.)
- `convex/http.ts` - HTTP route mounting for webhooks and OAuth
- Various domain modules: clients.ts, googleDrive.ts, jotform.ts, trello.ts, etc.

### Authentication Flow
1. `middleware.ts` - `convexAuthNextjsMiddleware()` redirects unauthenticated users
2. `app/layout.tsx` - Provides ConvexAuthNextjsServerProvider + ConvexAuthNextjsProvider
3. `app/admin/layout.tsx` - AccessGuard checks api.users.me, redirects to /brak-dostepu if inactive/no role
4. Protected routes: `/admin/*` require authentication

### Role-Based Access Control
- **Roles**: admin, sales, montaz (defined in USER_ROLES in schema.ts)
- `requireRole(ctx, "admin")` in Convex functions
- `roles: ["admin"]` in NavItem component hides/shows sidebar links
- User management: `/admin/ustawienia/uzytkownicy` (admin only)
- Password change: `/admin/ustawienia/konto` (all authenticated users)

## 🚀 Features

### Lead Management
- **Jotform Webhook Integration**: Automatic lead creation from form submissions
- **Manual Client Addition**: Sales team can add clients manually
- **Data Visibility Rules**: Contact info always visible; service/quote data visible only from "measurement" status onward
- **Duplicate Prevention**: Email-based deduplication with event tracking
- **Source Tracking**: Distinguishes between "jotform" and "manual" sources

### Customer Workflow
- **Status Pipeline**: lead → inquiry → measurement → offer → contract → production → installation → completed → warranty
- **Status Transition Rules**: Enforced business logic for valid status changes
- **Automated Triggers**: 
  - Status change to "measurement" → Creates Google Drive folder + reveals quote data
  - Checkbox actions → Generate documents from templates
- **Inline Editing**: Click-to-edit fields with autosave
- **Event Timeline**: Chronological history of all actions

### Document Generation
- **Google Drive Template System**: Store and manage .docx templates
- **Dynamic Field Mapping**: Admin-configurable placeholder → data field mappings
- **Mail Merge**: Server-side find/replace in documents
- **Idempotent Operations**: Prevents duplicate document generation
- **Special Cases**: 
  - "Guarantee" checkbox generates two documents (ALCO + ADK)
  - Manufacturer warranty card uploads

### Google Drive Integration
- **OAuth 2.0 Flow**: Secure connection with token encryption
- **Auto-refresh**: Access tokens refreshed before expiration (<5 min)
- **Health Checks**: Scheduled every 30 minutes
- **Connection States**: connected, token_expiring, refreshing, expired, refresh_failed, disconnected, error
- **Folder Management**: 
  - Auto-creates client folders on status change to "measurement"
  - Format: `YYYY/MM/DD_Imię_Nazwisko_Miejscowość`
  - Idempotent: skips if folderId already exists
- **Template Management**: 
  - Select shared drive and templates folder
  - Copy templates to client folders with dynamic naming
  - Pattern support: `Pomiar_{{firstName}}_{{lastName}}_{{city}}`

### Configurable Views
- **Three View Modes**: Table, Kanban, Cards
- **Per-User Configuration**: Each user saves their own column order, sorting, filters
- **Admin Defaults**: Admin can set default view for new users
- **Table Features**:
  - Drag & drop column reordering
  - Customizable columns (Name, Status, Phone, Documents, Services, etc.)
  - Filtering (by status, location, service, date ranges)
  - Grouping (by status, city, service)
  - Document column shows icons with tooltips
- **Kanban View**: Columns = statuses, cards = clients, drag & drop status changes
- **Cards View**: Grid layout for quick client overview

### Notifications & Alerts
- **Google Drive Connection Issues**: 
  - Auto-detect token expiration and refresh failures
  - Dashboard banners for manual reconnection required
  - Email notifications for critical issues
- **Webhook Monitoring**: Logs of Jotform/Trello webhook receptions
- **System Events**: Client creation, status changes, document generation logged

## 🔧 Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- Git
- Accounts for:
  - [Convex](https://convex.dev)
  - [Clerk](https://clerk.com)
  - [Google Cloud Console](https://console.cloud.google.com)
  - [Jotform](https://jotform.com)
  - [Trello](https://trello.com) (optional)

### Step-by-Step Setup

#### 1. Repository Setup
```bash
git clone <repository-url>
cd ADKokna
npm install
```

#### 2. Environment Variables
Create `.env.local` in the project root:

```bash
# Convex
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_FRONTEND_API_URL=https://your-clerk-instance.clerk.accounts.dev
```

#### 3. Convex Project Setup
```bash
# First time setup
npx convex dev  # This creates your initial deployment

# Set required environment variables in Convex dashboard
npx convex env set ENCRYPTION_KEY "$(openssl rand -hex 32)"
npx convex env set CLERK_FRONTEND_API_URL "https://your-clerk-instance.clerk.accounts.dev"
```

#### 4. Clerk Configuration
1. Create account and application at [clerk.com](https://clerk.com)
2. Enable Email + Password and/or Google SSO login methods
3. Copy keys from Clerk dashboard:
   - Publishable Key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Secret Key → `CLERK_SECRET_KEY`
   - Frontend API URL → `CLERK_FRONTEND_API_URL`
4. Enable Convex integration in Clerk Dashboard > Integrations
5. Set `CLERK_JWT_ISSUER_DOMAIN` in Convex (same as `CLERK_FRONTEND_API_URL`):
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://verb-noun-00.clerk.accounts.dev"
   ```

#### 5. Google Drive Configuration (Optional but Recommended)
1. Create project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Drive API and Google Docs API
3. Configure OAuth consent screen (External type for public access)
4. Create OAuth 2.0 Client ID (Web application)
   - Authorized redirect URI: `https://your-convex-deployment.convex.site/api/google-drive/callback`
5. Set credentials in Convex:
   ```bash
   npx convex env set GOOGLE_CLIENT_ID "your-client-id.apps.googleusercontent.com"
   npx convex env set GOOGLE_CLIENT_SECRET "GOCSPX-..."
   npx convex env set APP_URL "http://localhost:3000"
   ```

#### 6. Jotform Configuration (Optional)
1. Get API key from Jotform Settings > API
2. Either:
   - Configure via Admin UI (/admin/ustawienia → Jotform tab)
   - Or set environment variables:
     ```bash
     npx convex env set JOTFORM_API_KEY "your-api-key"
     npx convex env set JOTFORM_FORM_ID "your-form-id"
     npx convex env set JOTFORM_WEBHOOK_SECRET "dowolny-sekret"
     ```
3. Configure webhook in Jotform:
   - URL: `https://your-convex-deployment.convex.site/api/webhooks/jotform?secret=YOUR_SECRET`

#### 7. Trello Configuration (Optional)
1. Get API key and token from [Trello](https://trello.com/power-ups/admin)
2. Either:
   - Configure via Admin UI (/admin/ustawienia → Trello tab)
   - Or set environment variables:
     ```bash
     npx convex env set TRELLO_API_KEY "your-api-key"
     npx convex env set TRELLO_API_TOKEN "your-api-token"
     ```

### 8. Development Workflow
```bash
# Start both frontend and backend
npm run dev

# Frontend only
npm run dev:frontend

# Backend only (Convex dev sync)
npm run dev:backend

# Production build
npm run build

# Start production server
npm run start

# Linting
npm run lint
npm run lint -- --fix  # Auto-fix

# Testing
npm test                 # Full test suite
npm test -- convex/tests/clients.test.ts  # Specific test file
npm run test:watch       # Watch mode
```

## 📁 Project Structure

```
ADKokna/
├── app/                      # Next.js App Router
│   ├── admin/                # Admin panel (protected)
│   │   ├── dashboard/        # Dashboard with statistics
│   │   ├── klienci/          # Client management
│   │   │   ├── [id]/         # Individual client view
│   │   │   │   ├── ComplaintTab.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── nowy/         # New client form
│   │   │   └── page.tsx
│   │   ├── szablony/         # Template management
│   │   ├── ustawienia/       # Settings
│   │   │   ├── konto/        # Account settings
│   │   │   └── uzytkownicy/  # User management
│   │   └── layout.tsx        # Admin layout with AccessGuard
│   ├── login/                # Login page
│   │   └── page.tsx
│   ├── brak-dostepu/         # Access denied page
│   │   └── page.tsx
│   ├── layout.tsx            # Root layout with auth providers
│   └── page.tsx              # Home page (redirects)
├── components/               # Shared React components
│   ├── ConvexClientProvider.tsx  # Convex + Clerk provider
│   ├── AdminHeader.tsx
│   ├── AdminSidebar.tsx
│   ├── AdminTopbar.tsx
│   └── UserMenu.tsx
├── convex/                   # Backend (Convex)
│   ├── schema.ts             # Database schema
│   ├── _generated/           # Auto-generated types (DO NOT EDIT)
│   ├── auth.config.ts        # Auth configuration
│   ├── auth.ts               # Auth setup
│   ├── users.ts              # User management
│   ├── lib/                  # Helper libraries
│   │   ├── auth.ts           # Auth helpers
│   │   └── crypto.ts         # Encryption utilities
│   ├── clients.ts            # Client CRUD operations
│   ├── googleDrive.ts        # Google Drive integration
│   ├── googleDriveAuth.ts    # Google OAuth flow
│   ├── jotform.ts            # Jotform webhook handling
│   ├── jotformAdmin.ts       # Jotform configuration
│   ├── trello.ts             # Trello integration
│   ├── trelloWebhook.ts      # Trello webhook handling
│   ├── http.ts               # HTTP route router
│   ├── crons.ts              # Scheduled jobs
│   ├── seed.ts               # Test data seeder
│   └── tests/                # Backend tests
├── proxy.ts                  # Clerk middleware for /admin routes
├── middleware.ts             # Root middleware
├── instrumentation.ts        # Error monitoring (Sentry)
├── next.config.ts            # Next.js configuration
├── vercel.json               # Vercel deployment config
├── package.json              # Dependencies and scripts
├── README.md                 # Quick start guide
├── PRD_v2_ADK_ALCO.md        # Detailed product requirements
├── AGENTS.md                 # Development guidelines
├── CLAUDE.md                 # Claude Code instructions
├── DOCUMENTATION.md          # This file
└── .env.local                # Environment variables (gitignored)
```

## 🗄️ Database Schema

### Extended User Schema (from Convex Auth)
- `role`: "admin" | "sales" | "montaz"
- `isActive`: boolean
- `displayName`: string
- `email`: string (used as login identifier)

### Clients Table
- `firstName`: string (required)
- `lastName`: string (required)
- `email`: string (optional, unique-ish for deduplication)
- `phone`: string
- `city`: string
- `address`: string
- `services`: string[] (Okna, Drzwi, Brama, etc.)
- `windowColor[]`, `doorColor[]`, `gateColor[]`, `terraceColor[]`, `constructionColor[]`, `sunProtectionType[]`
- `projectFiles`: string (URL)
- `comment`: string
- `status`: "lead" | "inquiry" | "measurement" | "offer" | "contract" | "production" | "installation" | "completed" | "warranty"
- `source`: "jotform" | "manual"
- `jotformSubmissionId`: string
- `createdBy`: string (Clerk userId)
- `createdAt`, `updatedAt`: timestamp

### Document Fields (per document type)
For each document type (pomiar, umowa, gwarancja_alco, rekojmia_adk, odbior_inwestor, protokol_montaz, faktura, reklamacja):
- `{type}Enabled`: boolean
- `{type}Url`: string (Google Drive file URL)
- `{type}GeneratedAt`: timestamp

### Related Tables
- `clientEvents`: History timeline (clientId, type, details, performedBy, timestamp)
- `documentTemplates`: Template management (key, name, googleDriveFileId, fileNamePattern, fieldMappings, version)
- `driveConnection`: Google Drive OAuth state (encrypted tokens, folder IDs, connection status)
- `viewConfig`: Per-user UI configuration (viewType, columns, sortBy, filters, groupBy)
- `warrantyCards`: Manufacturer warranty card uploads (clientId, manufacturer, type, fileUrl, uploadedAt)

## 🔐 Security Considerations

### Authentication & Authorization
- **Clerk**: Handles user authentication, session management, MFA options
- **Convex Auth**: Validates JWT tokens on backend, integrates with Clerk
- **Role-Based Access**: `requireRole()` checks in backend functions
- **Route Protection**: Middleware protects `/admin/*` routes
- **Component-Level**: `AccessGuard` checks in layouts

### Data Protection
- **Environment Variables**: Secrets stored in Convex dashboard (not in code)
- **Token Encryption**: OAuth tokens encrypted at rest using AES-256-GCM
- **Input Validation**: Convex validators on all function arguments
- **SQL Injection**: Convex ORM prevents injection attacks
- **XSS Protection**: React auto-escaping + sanitization where needed

### API Security
- **Webhook Secrets**: Jotform/Trello webhooks validated with shared secrets
- **CORS Configuration**: Limited to trusted domains in `http.ts`
- **Rate Limiting**: Implemented via Convex actions where needed
- **Audit Logging**: All significant actions logged in `clientEvents`

### Compliance
- **GDPR Ready**: Consent tracking via Jotform RODO field (not stored, informational only)
- **Data Retention**: Configurable via backend functions
- **Access Logs**: Who accessed what and when tracked

## ⚙️ Configuration Guide

### Admin Panel Access
Navigate to `/admin/ustawienia` after login to access:
- **Google Drive**: Connection management, folder selection
- **Jotform**: API key, form ID, webhook secret, test payload
- **Trello**: API key/token, board selection, list mapping, status synchronization
- **Account Settings**: Password change, profile management
- **User Management** (admin only): Create users, assign roles, activate/deactivate

### Google Drive Setup
1. Go to Admin → Settings → Google Drive
2. Click "Connect to Google Drive"
3. Complete OAuth flow with Google account
4. Select your Shared Drive ("Klienci")
5. Select your Templates folder
6. Save configuration
7. Use "Test Connection" to verify API access and permissions

### Jotform Webhook Setup
1. In Jotform, go to your form → Settings → Webhooks
2. Add webhook URL: `https://your-deployment.convex.site/api/webhooks/jotform?secret=YOUR_SECRET`
3. Set secret to match `JOTFORM_WEBHOOK_SECRET` environment variable
4. Select events: "Form Submission"
5. Save webhook

### Trello Synchronization (Optional)
1. Enable Trello sync in Admin → Settings → Trello
2. Enter your Trello API key and token
3. Select your board
4. Map CRM statuses to Trello lists
5. Save configuration
6. Click "Register Webhook" to set up real-time updates

## 🧪 Testing

### Backend Tests
Located in `convex/tests/`:
- `clients.test.ts` - Client CRUD operations
- `googleDrive.test.ts` - Google Drive integration
- `jotform.test.ts` - Webhook handling
- `trello.test.ts` - Trello integration
- `users.test.ts` - User management

Run tests:
```bash
# All tests
npm test

# Specific file
npm test -- convex/tests/clients.test.ts

# Watch mode
npm run test:watch
```

### Frontend Testing
Currently relies on manual testing and type checking. Consider adding:
- Component tests with Jest/Vitest
- E2E tests with Playwright or Cypress
- Visual regression testing

## 🚢 Deployment

### Vercel Deployment (Recommended)
The project is configured for Vercel deployment:

```bash
# Install Vercel CLI if not present
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables in Vercel
Set these in Vercel project settings:
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL` 
- `NEXT_PUBLIC_CONVEX_SITE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_FRONTEND_API_URL`

### Convex Environment Variables
Set via Convex dashboard or CLI:
- `ENCRYPTION_KEY`
- `CLERK_FRONTEND_API_URL` (or `CLERK_JWT_ISSUER_DOMAIN`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_URL`
- `JOTFORM_API_KEY`
- `JOTFORM_FORM_ID`
- `JOTFORM_WEBHOOK_SECRET`
- `TRELLO_API_KEY`
- `TRELLO_API_TOKEN`

### Database Migrations
Convex handles schema migrations automatically. For data migrations:
1. Use `convex/migration-helper` skill for widen-migrate-narrow pattern
2. Test migrations in temporary branch first
3. Use `complete_database_migration` to apply to main branch

## 📚 API Reference

### Convex Functions
All functions are type-safe and accessible via `api.module.functionName` in frontend.

#### Clients API (`api.clients`)
- `list({ filter, sort, limit })` - Query clients with filtering/sorting
- `get(clientId)` - Get single client
- `create(data)` - Create new client
- `update(clientId, data)` - Update client
- `remove(clientId)` - Delete client
- `changeStatus(clientId, newStatus)` - Change client status
- `updateDocumentStatus(clientId, docType, enabled, url?)` - Update document generation status

#### Google Drive API (`api.googleDrive`)
- `connect(authData)` - Establish connection
- `disconnect()` - Remove connection
- `testConnection()` - Verify API access
- `createClientFolder(client)` - Create folder for client
- `copyTemplate(templateId, client, fieldMappings)` - Generate document from template

#### Jotform API (`api.jotform`)
- `handleWebhook(payload)` - Process incoming webhook
- `configure(settings)` - Save Jotform settings
- `testConnection()` - Verify API connectivity

#### User Management API (`api.users`)
- `me()` - Get current user info
- `list({ role, isActive })` - List users
- `create(data)` - Create new user (admin only)
- `setRole(userId, role)` - Change user role
- `setActive(userId, isActive)` - Activate/deactivate user
- `changeOwnPassword(currentPassword, newPassword)` - Change password
- `updateProfile(data)` - Update profile

### HTTP Endpoints
Accessible via direct HTTP requests:
- `POST /api/webhooks/jotform` - Jotform webhook endpoint
- `POST /api/webhooks/trello` - Trello webhook endpoint
- `GET /api/google-drive/callback` - Google OAuth callback
- `POST /api/auth/*` - Convex Auth endpoints (login, logout, etc.)

## 🔧 Troubleshooting

### Common Issues

#### Google Drive Connection Problems
- **Symptoms**: ❌ Error status, 401/403 errors
- **Solutions**:
  1. Check if access token expired → System should auto-refresh
  2. If refresh failed → Reconnect via Admin UI
  3. Verify Shared Drive and folder permissions
  4. Check Google Cloud Console for API quota limits
  5. Ensure "drive.file" and "drive" scopes are granted

#### Jotform Webhook Not Working
- **Symptoms**: No new clients appearing from form submissions
- **Solutions**:
  1. Verify webhook URL in Jotform matches deployment
  2. Check webhook secret matches environment variable
  3. Look at Convex logs for `[jotform]` prefixes
  4. Verify field mapping handles your form's field names
  5. Test with "Test Webhook" button in Admin UI

#### Authentication Issues
- **Symptoms**: Redirect loops, "Access denied" errors
- **Solutions**:
  1. Verify `CLERK_JWT_ISSUER_DOMAIN` matches `CLERK_FRONTEND_API_URL`
  2. Check Clerk domain configuration for authorized domains
  3. Ensure Convex auth.config.ts has correct domain setting
  4. Clear cookies and try fresh login
  5. Check browser console for auth-related errors

#### Performance Problems
- **Symptoms**: Slow UI loading, delayed responses
- **Solutions**:
  1. Check Convex query limits (use `.take()` or pagination)
  2. Verify proper indexing on queried fields
  3. Monitor Convex function execution times
  4. Consider pagination for large client lists
  5. Use `.withIndex()` or `.withSearchIndex()` instead of `.filter()`

### Getting Help
- Check Convex logs: `npx convex dev` shows real-time backend logs
- Review frontend console: Browser dev tools for React errors
- Monitor network requests: Check API response status codes
- Consult PRD_v2_ADK_ALCO.md for detailed feature specifications
- Review AGENTS.md for development best practices

## 📈 Future Enhancements

### Planned Features
1. **Advanced Reporting**: Dashboard with charts and export capabilities
2. **Email Integration**: Sync with email clients for communication tracking
3. **Calendar View**: Visualize measurements, installations, follow-ups
4. **Inventory Management**: Track materials and supplies
5. **Mobile App**: Progressive Web App or native mobile companion
6. **AI Assistance**: Smart suggestions for follow-ups, document generation
7. **Multi-language Support**: Polish/English interface toggle
8. **Advanced Permissions**: Granular permissions beyond role-based

### Technical Improvements
1. **GraphQL API**: Alternative to Convex's RPC-style API
2. **WebSocket Enhancements**: Real-time collaboration features
3. **Offline Capabilities**: Service workers for intermittent connectivity
4. **Microservices**: Split monolith for better scalability
5. **Event Sourcing**: Complete audit trail with event replay capability

## 📋 Contributing

### Development Guidelines
1. Follow existing code style (Prettier, ESLint)
2. Write tests for new functionality
3. Keep functions small and focused
4. Use Convex best practices (see AGENTS.md)
5. Validate all inputs in backend functions
6. Handle loading and error states in UI components
7. Use TypeScript strictly - avoid `any` type
8. Keep components reusable and composable

### Pull Request Process
1. Fork repository
2. Create feature branch: `git checkout -b feature/your-feature-name`
3. Make changes and commit: `git commit -m "feat: description of changes"`
4. Push to fork: `git push origin feature/your-feature-name`
5. Open pull request against main branch
6. Ensure CI passes and request review

### Code Review Checklist
- [ ] Functionality matches requirements
- [ ] Tests cover new code paths
- [ ] No breaking changes to existing API
- [ ] Security considerations addressed
- [ ] Performance implications evaluated
- [ ] Error handling implemented
- [ ] Documentation updated if needed
- [ ] Follows established patterns and conventions

## 📄 License

This project is proprietary software for ADK Okna. All rights reserved.

---

*Documentation last updated: 2026-05-19*
*For questions or support, contact the development team*