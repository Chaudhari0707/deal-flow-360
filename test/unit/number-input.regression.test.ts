import { expect, test } from "bun:test";

import {
  coerceNumberTyping,
  integerFieldMessage,
  isPartialNumberInput,
  normalizeNumberInput,
  numberInputValidationMessage,
  parseNumberInput,
} from "@/components/ui/number-input-utils";

test("number input retains leading-zero decimal editing states before blur", () => {
  expect(isPartialNumberInput("0.")).toBe(true);
  expect(isPartialNumberInput(".5")).toBe(true);
  expect(parseNumberInput("0.")).toBe(0);
  expect(parseNumberInput(".5")).toBe(0.5);
  expect(normalizeNumberInput("000.50")).toBe("0.5");
});

test("typing over a default zero replaces it instead of creating a leading zero", () => {
  expect(coerceNumberTyping("03")).toBe("3");
  expect(coerceNumberTyping("003")).toBe("3");
  expect(coerceNumberTyping("-03")).toBe("-3");
  expect(coerceNumberTyping("0")).toBe("0");
  expect(coerceNumberTyping("0.")).toBe("0.");
  expect(coerceNumberTyping("0.5")).toBe("0.5");
  expect(coerceNumberTyping("")).toBe("");
});

test("number input reports malformed, out-of-range, and step-mismatched values", () => {
  expect(numberInputValidationMessage({ value: "1..5" })).toBe("Enter a number.");
  expect(numberInputValidationMessage({ value: "0", min: 1 })).toBe("Enter at least 1.");
  expect(numberInputValidationMessage({ value: "12", max: 10 })).toBe("Enter at most 10.");
  expect(numberInputValidationMessage({ value: "1.5", step: 1 })).toBe(
    "Use a whole number (no decimals).",
  );
  expect(numberInputValidationMessage({ value: "1.5", min: 0, max: 2, step: 0.5 })).toBe("");
});

test("integer field messages explain the fix in plain language", () => {
  expect(integerFieldMessage(Number.NaN, 1, 100, "quantity")).toBe("Enter a quantity.");
  expect(integerFieldMessage(1.5, 1, 100, "quantity")).toBe("Use a whole number (no decimals).");
  expect(integerFieldMessage(0, 1, 100, "quantity")).toBe("Enter at least 1.");
  expect(integerFieldMessage(101, 1, 100, "quantity")).toBe("Enter at most 100.");
  expect(integerFieldMessage(8, 1, 100, "quantity")).toBeUndefined();
});
