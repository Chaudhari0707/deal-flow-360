import { expect, test } from "bun:test";

import { isThemeOption, THEME_OPTIONS } from "@/features/shell/theme-options";

test("appearance control exposes light, dark, and system only", () => {
  expect(THEME_OPTIONS.map((option) => option.id)).toEqual(["light", "dark", "system"]);
  expect(isThemeOption("light")).toBe(true);
  expect(isThemeOption("dark")).toBe(true);
  expect(isThemeOption("system")).toBe(true);
  expect(isThemeOption("auto")).toBe(false);
  expect(isThemeOption(undefined)).toBe(false);
});
