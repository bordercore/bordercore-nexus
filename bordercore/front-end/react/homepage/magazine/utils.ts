const URL_PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

export function fillUrlTemplate(template: string, uuid: string): string {
  return template.replace(URL_PLACEHOLDER, uuid);
}

export function extractHost(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return url;
  }
}

export function faviconUrl(url: string): string | null {
  const host = extractHost(url);
  if (!host || host === url) return null;
  return `https://www.bordercore.com/favicons/${host}.ico`;
}

interface IssueDateParts {
  weekday: string;
  date: string;
  time: string;
  iso: string;
  issueNumber: string;
}

export function formatIssueDate(now: Date = new Date()): IssueDateParts {
  const weekday = now.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const date = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const iso = now.toISOString().slice(0, 10);
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const issueNumber = String(dayOfYear).padStart(3, "0");
  return { weekday, date, time, iso, issueNumber };
}

export function splitStartPretty(start: string): { weekday: string; time: string } {
  const idx = start.indexOf(" ");
  if (idx === -1) return { weekday: "", time: start };
  return { weekday: start.slice(0, idx), time: start.slice(idx + 1) };
}
