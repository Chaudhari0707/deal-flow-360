"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import {
  isPartialNumberInput,
  normalizeNumberInput,
  numberInputValidationMessage,
  parseNumberInput,
} from "@/components/ui/number-input-utils";

type NumberInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "defaultValue" | "type" | "value"
> & {
  defaultValue?: number;
  onValueChange?: (value: number | undefined) => void;
  value?: number | null;
};

function toNumber(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function displayValue(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : String(value);
}

function NumberInput({
  defaultValue,
  max,
  min,
  onBlur,
  onChange,
  onFocus,
  onValueChange,
  step,
  value,
  ...props
}: NumberInputProps) {
  const [rawValue, setRawValue] = React.useState(() => displayValue(value ?? defaultValue));
  const lastValidValue = React.useRef(rawValue);
  const isControlled = value !== undefined;
  const minNumber = toNumber(min);
  const maxNumber = toNumber(max);
  const stepNumber = step === "any" ? undefined : toNumber(step);

  const controlledValue = value !== null && Number.isFinite(value) ? value : undefined;
  const displayRawValue =
    isControlled && parseNumberInput(rawValue) !== controlledValue ? displayValue(value) : rawValue;

  function setValidity(input: HTMLInputElement, nextValue: string) {
    input.setCustomValidity(
      numberInputValidationMessage({
        value: nextValue,
        min: minNumber,
        max: maxNumber,
        step: stepNumber,
      }),
    );
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode={stepNumber !== undefined && !Number.isInteger(stepNumber) ? "decimal" : "numeric"}
      pattern="-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)"
      min={min}
      max={max}
      step={step}
      defaultValue={isControlled ? undefined : defaultValue}
      value={isControlled ? displayRawValue : undefined}
      onFocus={(event) => {
        lastValidValue.current = event.currentTarget.value;
        onFocus?.(event);
      }}
      onBlur={(event) => {
        const nextValue = normalizeNumberInput(event.currentTarget.value);
        event.currentTarget.value = nextValue;
        lastValidValue.current = nextValue;
        setRawValue(nextValue);
        setValidity(event.currentTarget, nextValue);
        onBlur?.(event);
      }}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        if (!isPartialNumberInput(nextValue)) {
          event.currentTarget.value = lastValidValue.current;
          return;
        }

        lastValidValue.current = nextValue;
        if (isControlled) setRawValue(nextValue);
        setValidity(event.currentTarget, nextValue);
        onValueChange?.(parseNumberInput(nextValue));
        onChange?.(event);
      }}
    />
  );
}

export { NumberInput };
