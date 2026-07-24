# Trading Card PWA

Local-first trading card studio and collection: SQLite (via sql.js) in the browser, card art in OPFS or IndexedDB, optional Supabase sync. Next.js 16 + Serwist for offline.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **https** or **localhost** so OPFS and export-folder APIs work.

## Build

```bash
npm run lint
npm run test
npm run build
```

## Vault backup (ZIP)

In **Settings → Local vault backup**, download a ZIP containing:

- `vault.sqlite` — full app database at export time  
- `media/<fileId>` — blobs referenced by cards (and set symbol assets if present)

Files go to your configured **export folder** when supported, otherwise the browser download bar.

**Restore (guided):** In **Settings → Local vault backup → Restore from backup (ZIP)**, pick a previously downloaded backup. The app validates the archive (SQLite header + expected tables) before anything is touched, asks for confirmation, then replaces this device's database and media and reloads. Restoring is all-or-nothing and cannot be undone — export a fresh backup first if unsure.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Serwist](https://serwist.pages.dev/) for the service worker
