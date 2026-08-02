# SHAB-Legal-Consultancy-App
Professional legal practice management system for SHAB Legal Consultancy with case management, calendar, tasks, documents, offline support, and real-time collaboration.

## Startup and development

### Required environment variables

Create a local environment file such as `.env.local` and configure the required Supabase variables without committing secrets:

```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Do not commit `.env.local` or real credentials.

### Install dependencies

```bash
npm install
```

### Start the app safely

```bash
npm run dev
```

This command will:
- verify `node_modules` is installed
- verify required env vars are present
- check port `5173`
- reuse an existing healthy Vite server if present
- avoid duplicate dev servers
- start Vite bound to `0.0.0.0` for Codespaces/browser forwarding

### Recover from a stale or blocked port

```bash
npm run dev:clean
```

Use that when port `5173` is occupied by a stale Vite process from this workspace.

### Verify the project

```bash
npm run healthcheck
```

This command runs:
- TypeScript build
- required env validation
- important project file checks
- port/process validation

### Production build and preview

```bash
npm run build
npm run preview
```

`npm run preview` binds to `0.0.0.0` on port `4173` by default.
