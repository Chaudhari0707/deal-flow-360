export async function loadOptionalEnvFile(path: string) {
  const file = Bun.file(path);
  if (!(await file.exists())) return;

  for (const sourceLine of (await file.text()).split("\n")) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    if (Bun.env[key] === undefined) Bun.env[key] = value;
  }
}
