# Home Automation User Control Dashboard

A local-network hobby system for modeling user-adjustable home-automation controls with multi-clock analytics and preference inference.

## Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Initial Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Run tests:
   ```bash
   pnpm test
   ```

3. First-time Convex setup (one-time only):
   When you first run `pnpm dev`, Convex will prompt you:
   - Select **"Start without an account (run Convex locally)"**
   - This is a one-time setup; Convex will remember your choice
   - After this, `pnpm dev` will run without prompts

### Development

Start both Convex and web dev servers:
```bash
pnpm dev
```

Or start them separately:
```bash
pnpm dev:web    # Web app only (http://localhost:3000)
pnpm dev:convex # Convex backend only (runs locally, no auth)
```

**Note:** Convex runs in `--local` mode, which means:
- No authentication or account required
- Data is stored locally on your machine
- Perfect for hobby projects and local development
- All data stays on your local network

## Project Structure

- `apps/web/` - TanStack Start web app (placeholder UI in Milestone 1)
- `packages/core/` - Shared TypeScript logic (no framework dependencies)
- `convex/` - Convex schema, mutations, queries

## Milestones

This project is being implemented milestone-by-milestone. See `docs/plans/IMPLEMENTATION_PLAN.md` for details.

**Current Status:** Milestone 1 complete - Monorepo scaffold and local dev runtime.
