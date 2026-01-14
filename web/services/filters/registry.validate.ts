// web/services/filters/registry.validate.ts
//
// Fail-fast startup/CI validation entrypoint.
// Usage:
//   - Import + call validateRegistryOrThrow() during server boot
//   - Or run directly in CI (ESM):
//       node dist/web/services/filters/registry.validate.js
//
// Guarantees:
// - Registry file parses
// - Zod schema validates
// - Semantic invariants validate (no drift)

import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadFilterRegistry, registryHash } from "./registry";

/**
 * Stable public entrypoint for server startup.
 * Throws on any registry drift or schema violation.
 */
export function validateRegistryOrThrow(): void {
  // loadFilterRegistry() performs schema + invariants validation.
  // registryHash() forces canonical hashing path as well.
  loadFilterRegistry();
  registryHash();
}

function getExecutedPathInfo() {
  const thisFile = fileURLToPath(import.meta.url);
  const argv1 = process.argv?.[1] ?? null;
  return {
    thisFile: path.resolve(thisFile),
    argv1: argv1 ? path.resolve(argv1) : null,
    cwd: process.cwd(),
  };
}

function isExecutedDirectly(): boolean {
  // ESM equivalent of `require.main === module`
  // Compare the resolved file path of this module vs argv[1].
  const { thisFile, argv1 } = getExecutedPathInfo();
  if (!argv1) return false;

  // Some node invocations may include symlinks; resolve is usually sufficient.
  return thisFile === argv1;
}

async function main() {
  const reg = loadFilterRegistry();
  const hash = registryHash();

  // Attempt to report which registry file was read (derived from CWD conventions).
  const registryPath = path.resolve(process.cwd(), "web/config/filterRegistry.v1.json");

  // Keep output simple and parseable for CI logs.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        version: reg.version,
        revision: reg.revision ?? null,
        scope: reg.scope,
        registryHash: hash,
        filterCount: reg.filters.length,
        registryPath,
        exec: getExecutedPathInfo(),
      },
      null,
      2
    )
  );
}

if (isExecutedDirectly()) {
  main().then(
    () => process.exit(0),
    (err) => {
      const e = err as any;

      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: String(e?.message || e),
            // Avoid huge stack spam but keep enough context for CI debugging.
            stack: typeof e?.stack === "string" ? e.stack.split("\n").slice(0, 15).join("\n") : null,
            exec: getExecutedPathInfo(),
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  );
}
