export function parseNumberInput(value: string) {
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function isPartialNumberInput(value: string) {
  return value === "" || value === "-" || value === "." || /^-?(?:\d+\.?\d*|\.\d*)$/.test(value);
}

export function normalizeNumberInput(value: string) {
  const number = parseNumberInput(value);
  return number === undefined ? value : String(number);
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
  if (number === undefined) return "Enter a valid number.";
  if (min !== undefined && number < min) return `Enter a number greater than or equal to ${min}.`;
  if (max !== undefined && number > max) return `Enter a number less than or equal to ${max}.`;
  if (
    step !== undefined &&
    Math.abs((number - (min ?? 0)) / step - Math.round((number - (min ?? 0)) / step)) > 1e-9
  ) {
    return `Enter a multiple of ${step}.`;
  }

  return "";
}
