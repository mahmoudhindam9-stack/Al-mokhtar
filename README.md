<div align="center">
  <img alt="المختار لإدارة المشروعات" src="./public/al-mokhtar-logo.svg" width="420" />
</div>

# المختار لإدارة المشروعات

A complete **project management and accounting ERP** built on [TanStack Start](https://tanstack.com/start) + [Supabase](https://supabase.com), featuring integrated point-of-sale, multi-warehouse inventory, recipe/BOM stock tracking, multi-currency accounting, and HR modules. The UI is fully localized in Arabic (RTL).

> Status: actively developed. See `AGENTS.md` for the Lovable sync contract.

## Modules

| Module               | Routes              | Notes                                                                         |
| -------------------- | ------------------- | ----------------------------------------------------------------------------- |
| **Admin dashboard**  | `/admin/*`          | accounts, HR, mall, inventory, ledger, menu, orders, receipts, reports, users |
| **POS**              | `/pos`              | Table/order lifecycle, upsells, timer                                         |
| **Captain**          | `/captain`          | Waiter-facing order station with QR                                           |
| **Cashier Treasury** | `/cashier-treasury` | Till, payouts, transfers, currency conversion                                 |
| **Menu**             | `/menu`             | Recipes linked to inventory ingredients                                       |

## Key capabilities

- **Multi-currency**: EGP + USD with currency _coefficients_ and journal-level conversion.
- **Atomic inventory**: recipe BOM deduction tied to order completion; tracking mode + multi-warehouse.
- **Ledger**: journal entries, Excel upload via `ArrayBuffer`, balance validation per currency.
- **Offline-friendly Supabase client**: graceful fallback fetch wrapper for local mode.

## Run locally

**Prerequisites:** Node.js 22+, [pnpm or npm](AGENTS.md)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template (the app works locally without cloud credentials):
   ```bash
   cp .env.example .env.local
   ```
3. Start the dev server:
   ```bash
   npm run dev   # http://localhost:3000
   ```

The application does not contain a default remote database connection. To enable cloud features later, create a dedicated Al-Mokhtar database and configure only the `VITE_AL_MOKHTAR_SUPABASE_URL` and `VITE_AL_MOKHTAR_SUPABASE_PUBLISHABLE_KEY` variables. Generic Supabase variables from other apps are intentionally ignored.

## Database

- Database migrations for the future dedicated Al-Mokhtar project live in [`supabase/migrations`](./supabase/migrations).
- Do not apply these migrations to another application's database.
- Generated types: [`src/integrations/supabase/types.ts`](./src/integrations/supabase/types.ts).

## Scripts

| Command         | Description                           |
| --------------- | ------------------------------------- |
| `npm run dev`   | Vite dev server (host `0.0.0.0:3000`) |
| `npm run build` | Production build                      |
| `npm run lint`  | ESLint                                |
| `npm run test`  | Vitest                                |

## Notes for contributors

- Route files under `src/routes/` (e.g. `admin/ledger.tsx`, `inventory.tsx`, `pos.tsx`) are large and monolithic; prefer extracting to components/hooks.
- One-off repair scripts (`patch_*.cjs`, `fix_*.cjs`) accumulate in the repo root and are gitignored going forward — please delete any that are no longer needed.

<!-- deployment verification marker: 2026-08-29 -->
