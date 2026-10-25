const validVersion = value => typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
const validRelease = value => typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);

export function versionLabel(release, build) {
  if (!validRelease(release) || !validVersion(build)) return "版本检测中…";
  return `v${release}+${build.slice(0, 8)}`;
}

export class VersionTracker {
  constructor(current) { this.current = validVersion(current) ? current : null; this.pending = null; this.dismissed = null; this.candidate = null; this.since = 0; }
  observe(version, now) {
    if (!validVersion(version)) return;
    if (!this.current) this.current = version;
    if (version === this.current) { this.pending = null; this.candidate = null; this.dismissed = null; return; }
    if (version !== this.candidate) { this.candidate = version; this.since = now; }
    if (now - this.since >= 1000) this.pending = version;
  }
  dismiss() { this.dismissed = this.pending; }
  get shouldPrompt() { return Boolean(this.pending && this.pending !== this.dismissed); }
}

export function setupUpdates({ beforeUpdate }) {
  const tracker = new VersionTracker(document.querySelector('meta[name="flystar-build"]')?.content);
  const release = document.querySelector('meta[name="flystar-release"]')?.content;
  const badge = document.getElementById("currentVersion");
  const notice = document.getElementById("updateNotice");
  const apply = document.getElementById("updateApply");
  const reopen = document.getElementById("updateReopen");
  const detail = document.getElementById("updateDetail");
  let checking = false, confirming, latestRelease = release;
  function render() {
    if (badge) badge.textContent = `当前版本 ${versionLabel(release, tracker.current)}`;
    notice.hidden = !tracker.shouldPrompt;
    reopen.hidden = !tracker.pending;
    if (tracker.shouldPrompt)
      detail.textContent = `发现 ${versionLabel(latestRelease, tracker.pending)}。点击「立即更新」即可载入新版；本局重新开始，已保存的设置会保留。`;
  }
  async function latestVersion() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const url = new URL("./version.json", location.href);
      url.searchParams.set("_check", Date.now());
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Version check unavailable");
      const { version, release: availableRelease } = await response.json();
      if (!validVersion(version)) throw new Error("Invalid version");
      return { version, release: validRelease(availableRelease) ? availableRelease : release };
    } finally { clearTimeout(timeout); }
  }
  async function check() {
    if (checking || document.hidden) return;
    checking = true;
    try {
      const latest = await latestVersion();
      latestRelease = latest.release;
      tracker.observe(latest.version, Date.now());
      render();
      if (tracker.candidate && tracker.pending !== tracker.candidate) {
        clearTimeout(confirming);
        confirming = setTimeout(check, 1300);
      }
    } catch { /* Keep playing while the local server restarts or is offline. */ }
    finally { checking = false; }
  }
  apply.addEventListener("click", async () => {
    apply.disabled = true;
    apply.textContent = "正在更新…";
    try {
      const { version } = await latestVersion();
      if (version === tracker.current) { tracker.observe(version, Date.now()); render(); return; }
      beforeUpdate?.();
      const url = new URL(location.href);
      url.searchParams.set("_build", version);
      location.replace(url.href);
    } catch { detail.textContent = "暂时无法连接更新，请稍后再试。已保存的设置会保留。"; }
    finally { apply.disabled = false; apply.textContent = "立即更新"; }
  });
  document.getElementById("updateLater").addEventListener("click", () => { tracker.dismiss(); render(); });
  reopen.addEventListener("click", () => { tracker.dismissed = null; render(); });
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  let interval = setInterval(check, 2000);
  window.addEventListener("pagehide", () => { clearInterval(interval); clearTimeout(confirming); });
  window.addEventListener("pageshow", event => {
    if (event.persisted) { clearInterval(interval); interval = setInterval(check, 2000); check(); }
  });
  render();
  check();
}
