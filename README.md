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

**Restore (manual):** Replacing app data is advanced; keep the ZIP as a cold backup until a guided restore exists. In practice you would re-import the SQLite file into the app’s IndexedDB key (`sqlite-db-v1` in store `kv` of `trading-card-pwa`) and restore `media/*` into the same storage the app used (OPFS vs IndexedDB `media:*` keys). Prefer repeating an export after major app updates.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Serwist](https://serwist.pages.dev/) for the service worker
