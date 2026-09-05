"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isThemeOption, THEME_OPTIONS } from "@/features/shell/theme-options";

function subscribe() {
  return () => {};
}
function clientMounted() {
  return true;
}
function serverMounted() {
  return false;
}

export function ThemeToggle() {
  const mounted = useSyncExternalStore(subscribe, clientMounted, serverMounted);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const selected = mounted && isThemeOption(theme) ? theme : "system";
  const resolved = mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="relative"
            aria-label="Appearance"
            disabled={!mounted}
          />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(value) => {
            if (isThemeOption(value)) setTheme(value);
          }}
        >
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.id === "light" ? <Sun /> : option.id === "dark" ? <Moon /> : <Monitor />}
              {option.label}
              {option.id === "system" && mounted ? (
                <span className="ml-auto text-xs text-muted-foreground capitalize">{resolved}</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
