/*
 * Project: OpenCLAW-P2P / P2PCLAW
 * Copyright (c) 2026 Francisco Angulo de Lafuente
 * ORCID: https://orcid.org/0009-0001-1634-7063
 * Recorded on: 2026-11-05
 * SPDX-License-Identifier: MIT
 */

/**
 * Theme bootstrapping shared by the inline pre-paint script (layout.tsx)
 * and the client-side toggle. Stored preference: "light" | "dark" | absent (= follow OS).
 */
export const THEME_STORAGE_KEY = "p2pclaw-theme";

export type ThemePreference = "light" | "dark" | "system";

/**
 * Runs before first paint (inlined in <head>), so the correct palette is
 * applied without a flash. Kept tiny and dependency-free on purpose.
 */
export const themeInitScript = `(function(){var d=false;try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"){d=true}else if(t!=="light"){d=window.matchMedia("(prefers-color-scheme: dark)").matches}}catch(e){try{d=window.matchMedia("(prefers-color-scheme: dark)").matches}catch(_){}}var r=document.documentElement;if(d){r.classList.add("dark")}else{r.classList.remove("dark")}r.style.colorScheme=d?"dark":"light"})();`;
