import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "sqljs");
const outFile = join(outDir, "sql-wasm-browser.wasm");
const ver = "1.14.1";
const url = `https://cdn.jsdelivr.net/npm/sql.js@${ver}/dist/sql-wasm-browser.wasm`;

const ok =
  existsSync(outFile) &&
  statSync(outFile).size > 10_000;
if (!ok) {
  console.log("ensure-sqljs-wasm: downloading", url);
  mkdirSync(outDir, { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outFile, buf);
  console.log("ensure-sqljs-wasm: wrote", outFile);
}
