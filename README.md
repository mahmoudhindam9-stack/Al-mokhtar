<div align="center">
  <img alt="Restocash" src="https://placehold.co/1200x300?text=Restocash+%7C+Restaurant+ERP+%2B+POS" />
</div>

# Restocash

A complete **restaurant management ERP** built on [TanStack Start](https://tanstack.com/start) + [Supabase](https://supabase.com), featuring integrated point-of-sale, multi-warehouse inventory, recipe/BOM stock tracking, multi-currency accounting, and HR modules. The UI is fully localized in Arabic (RTL).

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

## Local offline setup

The repository is designed to run locally first. For the complete Windows package, run the **Build Al-Mokhtar offline Windows package** workflow in GitHub Actions and download its `Al-Mokhtar-Offline` artifact. Extract the ZIP, then double-click `setup.bat`. The package includes a portable Node.js runtime and installed dependencies; no internet connection is required to launch that prepared package.

If you are running a source checkout instead of the prepared package, Windows needs Node.js 22.12+ and an internet connection for the first `npm ci`. After dependencies are installed, launch `setup.bat` or run `npm run start:local`. The application listens only on `127.0.0.1:3000`.

The default local account is `admin` / `123456`. This is a first-run local convenience, not a security boundary against someone who has access to your Windows account, browser developer tools, or application files. Change the default password before using the app with real records.

## Supabase and online synchronization

No old Supabase project is selected by default. Without explicit environment variables, the app uses local mode and its Supabase client returns empty fallback responses rather than connecting to a pre-existing project.

When the new **Al-mokhtar** Supabase project is created, configure only its public project URL and publishable/anon key in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never put a service-role key in a `VITE_` variable. Online synchronization must be enabled after the new database schema and authenticated access policies are applied; don't apply the removed legacy migrations, which included temporary development access rules.

## Deploy to Vercel

Import `mahmoudhindam9-stack/Al-mokhtar` in Vercel and use the **TanStack Start** framework preset. The repository's Vercel build configuration installs the Nitro Vite adapter for deployment. Add the new Supabase public environment variables only after the new project is ready, and put any secret server-side AI key in `GEMINI_API_KEY` without a `VITE_` prefix. The local offline package works independently from the Vercel deployment.

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
