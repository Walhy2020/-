/** Fullscreen API needs a user click; embedded browsers can use a page-filling fallback. */
export function setupFullscreen({ area, button, canvas }) {
  const expanded = () => document.fullscreenElement === area || area.classList.contains("play-expanded");
  function sync() {
    const active = expanded();
    button.textContent = active ? "退出全屏 ⛶" : "全屏游玩 ⛶";
    button.setAttribute("aria-pressed", String(active));
    document.body.classList.toggle("game-expanded", area.classList.contains("play-expanded"));
  }
  button.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement === area) await document.exitFullscreen();
      else if (area.classList.contains("play-expanded")) area.classList.remove("play-expanded");
      else if (document.fullscreenEnabled && area.requestFullscreen) await area.requestFullscreen();
      else area.classList.add("play-expanded");
    } catch {
      if (document.fullscreenElement !== area) area.classList.add("play-expanded");
    }
    sync();
    canvas.focus({ preventScroll: true });
  });
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.fullscreenElement === area) {
      document.exitFullscreen().catch(() => {});
    }
    if (event.key === "Escape" && area.classList.contains("play-expanded")) {
      area.classList.remove("play-expanded"); sync(); canvas.focus({ preventScroll: true });
    }
  });
  sync();
}
