export async function runCommand(
  command: string[],
  options: { cwd?: string; env?: Record<string, boolean | string | undefined> } = {},
) {
  const env = options.env
    ? Object.fromEntries(
        Object.entries(options.env).map(([key, value]) => [
          key,
          typeof value === "boolean" ? String(value) : value,
        ]),
      )
    : undefined;
  const child = Bun.spawn(command, {
    cwd: options.cwd,
    env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} exited with code ${exitCode}`);
}
