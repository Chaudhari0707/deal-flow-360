# Local runtime and stylesheet compilation

The local application runs on Bun 1.4.0 and Next.js 16.3.3 with native Turbopack. Both
`next.config.ts` and `postcss.config.ts` remain TypeScript. Turbopack supports the PostCSS
TypeScript configuration directly; its compatibility is verified by the browser stylesheet
regression rather than inferred from the build exit code.

## Document dependency bundling

`next.config.ts` uses the supported `transpilePackages` setting for `exceljs`, `pdf-lib`, `rimraf`,
and `prettier`. Turbopack bundles these packages into the application server output. The latter
two packages otherwise appear in Next.js's default server external list.

With native external loading, a first-ever cold API request failed to resolve the generated
`exceljs-<hash>` alias. The symptom matches the reported
[Bun external module issue](https://github.com/oven-sh/bun/issues/25370). A clean hoisted Bun install
also reproduced the failure, so package layout alone is insufficient. Explicit bundling avoids
that failing resolution path through Next.js's supported configuration.

This keeps the selected Bun runtime, native Turbopack, and canonical TypeScript PostCSS configuration.
The cost is bundling the document-export dependencies during application compilation. Dependency
versions and generated package contents remain managed by Bun.

## Verification

A fresh output directory and a new Bun process were used. The first API request returned 200;
there were no retries or warm-up restarts. The same process passed compiled stylesheet checks,
real credentials authentication, the authorized workspace request, invoice PDF generation, report
PDF generation, and report XLSX generation. All downloads had the expected binary signatures.
The dashboard rendered without browser runtime errors.

`playwright/e2e/stylesheet.spec.ts` retains the CSS regression; the billing browser scenario exercises
PDF and XLSX downloads. Future runtime changes must additionally repeat the first-request check
with a previously unused output directory. These observations cover local macOS; other platforms
remain unverified until exercised.
