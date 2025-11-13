"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useSelector((s: RootState) => s.theme.mode);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      console.log("Dark mode enabled");
    } else {
      root.classList.remove("dark");
      console.log("Light mode enabled");
    }
  }, [theme]);

  return <>{children}</>;
}
