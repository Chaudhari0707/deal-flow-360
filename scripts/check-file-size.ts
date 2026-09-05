import { Glob } from "bun";

const ROOT = import.meta.dir.replace(/[\\/]scripts$/, "");
const ALLOWLIST_PATH = `${import.meta.dir}/file-size-allowlist.txt`;
const MAX_LINES = 500;

async function loadAllowlist(): Promise<Set<string>> {
  const file = Bun.file(ALLOWLIST_PATH);
  if (!(await file.exists())) return new Set();

  return new Set(
    (await file.text())
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#")),
  );
}

const allowlist = await loadAllowlist();
const violations: Array<{ lines: number; path: string }> = [];

for await (const path of new Glob("src/**/*.{ts,tsx}").scan({ cwd: ROOT, onlyFiles: true })) {
  const normalizedPath = path.replaceAll("\\", "/");
  if (allowlist.has(normalizedPath)) continue;

  const lineCount = (await Bun.file(`${ROOT}/${normalizedPath}`).text()).split("\n").length;
  if (lineCount > MAX_LINES) violations.push({ lines: lineCount, path: normalizedPath });
}

if (violations.length > 0) {
  violations.sort((left, right) => right.lines - left.lines);
  for (const violation of violations) {
    console.error(`${violation.lines.toString().padStart(5)}  ${violation.path}`);
  }
  throw new Error(`${violations.length} source file(s) exceed ${MAX_LINES} lines`);
}

console.log(`file-size: all source files are <= ${MAX_LINES} lines`);
