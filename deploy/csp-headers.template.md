# Content-Security-Policy (deploy template)

Tune for your host. Phase A is static + client-side only; default Next.js does not set CSP unless you add headers.

## Example (strict baseline)

Use `next.config.ts` `headers()` or reverse proxy (nginx, Cloudflare).

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self';
  worker-src 'self';
  manifest-src 'self';
  base-uri 'none';
  form-action 'self';
  frame-ancestors 'none';
```

## SQLite WASM + `unsafe-eval`

If you switch to a build of SQLite WASM that requires `eval`/`wasm-unsafe-eval`, you may need:

```
script-src 'self' 'wasm-unsafe-eval';
```

(or `'unsafe-eval'` only if unavoidable — prefer builds that do not need it.)

## Cross-origin isolation (optional)

Multi-threaded SQLite WASM sometimes needs `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for `SharedArrayBuffer`. **sql.js** (this project) runs single-threaded and usually does **not** require this.

## PWA / Serwist

Ensure `sw.js` is served from `script-src 'self'` and your precached assets match `default-src` / `img-src`.
