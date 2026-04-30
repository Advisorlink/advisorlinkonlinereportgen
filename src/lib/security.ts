// Domain allowlist — refuses to render the app on any other host.
// Add custom domains here once configured.
const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "report-reimagine-pro.lovable.app",
];

export function isHostAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  // Allow lovable preview/sandbox hosts (id-preview--*.lovable.app, *.lovableproject.com)
  if (host.endsWith(".lovableproject.com")) return true;
  if (host.endsWith(".lovable.app") && host.includes("8d1f1360-76d4-45e5-b6d4-568b6503cfde")) return true;
  return ALLOWED_HOSTS.includes(host);
}
