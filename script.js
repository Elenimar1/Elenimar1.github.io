const year = document.querySelector("#year");
const currentVersion = document.body?.dataset.siteVersion;
const versionCheckIntervalMs = 60_000;

if (year) {
  year.textContent = new Date().getFullYear();
}

async function refreshIfVersionChanged() {
  if (!currentVersion || !["http:", "https:"].includes(window.location.protocol)) {
    return;
  }

  try {
    const versionUrl = new URL("version.json", window.location.href);
    versionUrl.searchParams.set("t", Date.now().toString());

    const response = await fetch(versionUrl, { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    const latestVersion = typeof data.version === "string" ? data.version.trim() : "";

    if (latestVersion && latestVersion !== currentVersion) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("siteVersion", latestVersion);
      window.location.replace(nextUrl.toString());
    }
  } catch {
    // Ignore temporary network or deploy-cache failures.
  }
}

if (currentVersion) {
  window.setInterval(refreshIfVersionChanged, versionCheckIntervalMs);
  window.addEventListener("focus", refreshIfVersionChanged);
}
