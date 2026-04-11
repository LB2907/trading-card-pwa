import { defineConfig } from "drizzle-kit";

/** Schema reference for codegen; runtime migrations use `init-sql.ts` in the browser. */
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
