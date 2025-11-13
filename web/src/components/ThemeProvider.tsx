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
    console.log("ThemeProvider: theme changed to", theme);
    if (theme === "dark") {
      root.classList.add("dark");
      console.log("ThemeProvider: added 'dark' class to html");
    } else {
      root.classList.remove("dark");
      console.log("ThemeProvider: removed 'dark' class from html");
    }
    console.log("ThemeProvider: html classes:", root.classList.toString());
  }, [theme]);

  return <>{children}</>;
}
