export function parseNumberInput(value: string) {
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function isPartialNumberInput(value: string) {
  return value === "" || value === "-" || value === "." || /^-?(?:\d+\.?\d*|\.\d*)$/.test(value);
}

/** While typing, turn "03" into "3" so a default 0 is replaced instead of prefixed. */
export function coerceNumberTyping(next: string) {
  if (!isPartialNumberInput(next)) return next;
  const match = next.match(/^(-?)(0+)(.*)$/);
  if (!match) return next;
  const [, sign, , rest] = match;
  if (rest === "" || rest.startsWith(".")) return `${sign}0${rest}`;
  return `${sign}${rest}`;
}

export function normalizeNumberInput(value: string) {
  const number = parseNumberInput(value);
  return number === undefined ? value : String(number);
}

function formatBound(value: number) {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : String(value);
}

/** Shared copy for integer quantity/amount fields validated outside NumberInput. */
export function integerFieldMessage(
  value: number,
  min: number,
  max: number,
  noun = "number",
): string | undefined {
  if (!Number.isFinite(value)) return `Enter a ${noun}.`;
  if (!Number.isInteger(value)) return "Use a whole number (no decimals).";
  if (value < min) return `Enter at least ${formatBound(min)}.`;
  if (value > max) return `Enter at most ${formatBound(max)}.`;
}

export function numberInputValidationMessage({
  value,
  min,
  max,
  step,
}: {
  value: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  if (value === "") return "";

  const number = parseNumberInput(value);
  if (number === undefined) return "Enter a number.";
  if (min !== undefined && number < min) return `Enter at least ${formatBound(min)}.`;
  if (max !== undefined && number > max) return `Enter at most ${formatBound(max)}.`;
  if (
    step !== undefined &&
    Math.abs((number - (min ?? 0)) / step - Math.round((number - (min ?? 0)) / step)) > 1e-9
  ) {
    return step === 1 ? "Use a whole number (no decimals)." : `Use increments of ${step}.`;
  }

  return "";
}
