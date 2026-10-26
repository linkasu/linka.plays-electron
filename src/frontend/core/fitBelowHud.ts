// Testers: the game field sat under the «В меню» / «Пауза» buttons. Games now start
// below the HUD (styles/game-layout.css); on a short window, such as a laptop, some of
// them no longer fit, and some never did. This shrinks the game a little with CSS zoom
// until its lowest card or button is back on screen. Zoom keeps gaze targets right:
// getBoundingClientRect reports the zoomed boxes.

const containerSelector = ".game-page-shell__content, .v-container.game-container, .game-hud-clear";
const measuredSelector = ".v-card, .dwell-button, .v-btn";
const minZoom = 0.7;
const bottomGapRem = 0.5;

function lowestBottom(root: HTMLElement) {
  // The content box itself, and every card or button in it (some overflow their box).
  let bottom = root.getBoundingClientRect().bottom;
  for (const element of root.querySelectorAll<HTMLElement>(measuredSelector)) {
    if (element.closest(".game-hud")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/** Shrinks the game below the HUD when it does not fit the window; returns a cleanup. */
export function fitGameBelowHud() {
  if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return () => {};
  let content: HTMLElement | null = null;
  let frame = 0;

  const fit = () => {
    frame = 0;
    const container = document.querySelector<HTMLElement>(containerSelector);
    const next = container?.firstElementChild as HTMLElement | null;
    if (next !== content) {
      if (content) {
        observer.unobserve(content);
        content.style.zoom = "";
      }
      content = next;
      if (content) observer.observe(content);
    }
    if (!content) return;
    const current = Number(content.style.zoom) || 1;
    const top = content.getBoundingClientRect().top;
    const naturalHeight = (lowestBottom(content) - top) / current;
    if (naturalHeight <= 0) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const containerPadding = parseFloat(getComputedStyle(container!).paddingBottom) || 0;
    const available = window.innerHeight - top - containerPadding - bottomGapRem * rem;
    const zoom = Math.max(minZoom, Math.min(1, available / naturalHeight));
    // Ignore tiny changes so the zoom does not chase its own re-layout.
    if (Math.abs(zoom - current) < 0.02) return;
    content.style.zoom = zoom >= 0.995 ? "" : zoom.toFixed(3);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(fit);
  };

  const observer = new ResizeObserver(schedule);
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  schedule();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    observer.disconnect();
    mutations.disconnect();
    window.removeEventListener("resize", schedule);
    if (content) content.style.zoom = "";
  };
}
