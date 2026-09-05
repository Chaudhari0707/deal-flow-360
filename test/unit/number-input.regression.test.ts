import { expect, test } from "bun:test";

import {
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

test("number input reports malformed, out-of-range, and step-mismatched values", () => {
  expect(numberInputValidationMessage({ value: "1..5" })).toBe("Enter a valid number.");
  expect(numberInputValidationMessage({ value: "0", min: 1 })).toBe(
    "Enter a number greater than or equal to 1.",
  );
  expect(numberInputValidationMessage({ value: "1.5", step: 1 })).toBe("Enter a multiple of 1.");
  expect(numberInputValidationMessage({ value: "1.5", min: 0, max: 2, step: 0.5 })).toBe("");
});
