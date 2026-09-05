const result = await Bun.build({
  entrypoints: [`${import.meta.dir}/index.ts`],
  outdir: `${import.meta.dir}/dist`,
  target: "node",
  format: "esm",
  minify: true,
});

if (!result.success) {
  console.error("Build failed:", result.logs);
  // @ts-expect-error Bun types are available but `exit()` never returns — noUnusedLocals safety
  Bun.exit(1);
}

export {};
