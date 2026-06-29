import { useEffect, useState } from "react";
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ThemeId = "midnight" | "graygold" | "orange" | "light";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  swatch: string; // primary accent color
  bg: string;     // representative background
  isDark: boolean;
}

export const THEMES: ThemeDef[] = [
  { id: "midnight",  label: "Midnight Gold",    swatch: "#e6c44a", bg: "#0c1530", isDark: true  },
  { id: "graygold",  label: "Graphite Gold",    swatch: "#e6c44a", bg: "#3a3a3d", isDark: true  },
  { id: "orange",    label: "Orange Night",     swatch: "#ff8a3d", bg: "#161009", isDark: true  },
  { id: "light",     label: "Light",            swatch: "#caa14a", bg: "#fafaf6", isDark: false },
];

const STORAGE_KEY = "fm-theme";
const ALL_CLASSES = THEMES.map((t) => `theme-${t.id}`);

function readStored(): ThemeId {
  if (typeof window === "undefined") return "midnight";
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return "midnight";
  // Legacy values "dark" / "light" → map to midnight / light
  if (raw === "dark") return "midnight";
  if (raw === "light") return "light";
  if (THEMES.some((t) => t.id === raw)) return raw as ThemeId;
  return "midnight";
}

function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.classList.remove(...ALL_CLASSES);
  el.classList.add(`theme-${id}`);
  // Keep the "dark" class in sync so tailwind dark: variants behave.
  const def = THEMES.find((t) => t.id === id);
  el.classList.toggle("dark", def?.isDark !== false);
}

export function useThemeInit() {
  useEffect(() => {
    applyTheme(readStored());
  }, []);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>("midnight");
  useEffect(() => setTheme(readStored()), []);

  const choose = (id: ThemeId) => {
    setTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tema">
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => choose(t.id)}
            className="flex items-center gap-2"
          >
            <span
              className="inline-block size-4 rounded-full border border-border"
              style={{
                background: `linear-gradient(135deg, ${t.bg} 50%, ${t.swatch} 50%)`,
              }}
              aria-hidden
            />
            <span className="flex-1">{t.label}</span>
            {theme === t.id && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}