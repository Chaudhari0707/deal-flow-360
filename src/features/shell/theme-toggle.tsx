"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
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
import { cn } from "@/lib/utils";

const eyebrow = "text-[0.6875rem] font-medium tracking-[0.16em] uppercase";

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
            variant="ghost"
            size="icon-sm"
            className="relative rounded-none text-muted-foreground hover:text-foreground"
            aria-label="Appearance"
            disabled={!mounted}
          />
        }
      >
        <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup
          value={selected}
          onValueChange={(value) => {
            if (isThemeOption(value)) setTheme(value);
          }}
        >
          <DropdownMenuLabel className={cn(eyebrow, "px-1.5 pt-1 pb-2 text-muted-foreground")}>
            Appearance
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="rounded-none py-1.5"
            >
              {option.label}
              {option.id === "system" && mounted ? (
                <span className={cn(eyebrow, "ml-auto text-muted-foreground")}>{resolved}</span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
