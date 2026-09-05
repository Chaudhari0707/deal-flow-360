export interface ThemeOption {
  id: ThemeOptionId;
  label: string;
}

export type ThemeOptionId = "dark" | "light" | "system";
