import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function useThemeInit() {
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("fm-theme") : null;
    const dark = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
}

export function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("fm-theme");
    setDark(stored ? stored === "dark" : true);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem("fm-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}