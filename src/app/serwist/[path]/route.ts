import { randomUUID } from "crypto";
import { createSerwistRoute } from "@serwist/turbopack";

const revision = randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    additionalPrecacheEntries: [{ url: "/offline", revision }],
    useNativeEsbuild: true,
  });
