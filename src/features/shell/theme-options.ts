import type { ThemeOption, ThemeOptionId } from "@/features/shell/_types/theme";

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function isThemeOption(value: string | undefined): value is ThemeOptionId {
  return THEME_OPTIONS.some((option) => option.id === value);
}
