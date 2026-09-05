const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const appEntry = Bun.file(`${ROOT}/src/app/layout.tsx`);
const pagesEntry = Bun.file(`${ROOT}/src/pages/_app.tsx`);

if (!(await appEntry.exists()) && !(await pagesEntry.exists())) {
  console.log("build: skipped until a Next.js app entry exists");
} else {
  const child = Bun.spawn(["bun", "--bun", "next", "build"], {
    cwd: ROOT,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`next build exited with code ${exitCode}`);
}
