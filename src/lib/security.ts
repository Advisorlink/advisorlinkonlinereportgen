// Domain allowlist - refuses to render the app on any other host.
// Add custom domains here once configured.
const ALLOWED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "report-reimagine-pro.lovable.app",
  "advisorlinkonlinereportgen.lovable.app",
  "report.advisorlinkonline.com.au",
  "www.report.advisorlinkonline.com.au",
];

export function isHostAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  const allowedHosts = ALLOWED_HOSTS.map((allowedHost) => allowedHost.toLowerCase().replace(/^www\./, ""));
  // Allow all Lovable preview/sandbox/published hosts
  if (host.endsWith(".lovableproject.com")) return true;
  if (host.endsWith(".lovable.app")) return true;
  if (host.endsWith(".lovable.dev")) return true;
  return allowedHosts.includes(host);
}
