import { MAX_TAGS, MAX_TAG_LENGTH, RESOURCE_TYPES, type ResourceType } from "./constants";

export type Errors = Record<string, string>;

/**
 * Turns what a teacher typed or pasted into a web address.
 * "deped.gov.ph/x" becomes "https://deped.gov.ph/x". Any other scheme (javascript:, ftp:, data:, file:)
 * is left alone so validateUrl can refuse it.
 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[a-z0-9.-]+:\d+(\/|$)/i.test(s)) return s;
  if (s.startsWith("//")) return s;
  return `https://${s}`;
}

/** Only http(s) links with a real host are accepted. */
export function validateUrl(url: string): string | null {
  if (!url) return "Enter a link.";
  if (url.length > 2000) return "That link is too long.";
  if (/\s/.test(url)) return "A link cannot contain spaces.";
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "That does not look like a valid link.";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return "Only http:// and https:// links can be saved.";
  if (!u.hostname || !/^[^/$?#]/.test(url.replace(/^https?:\/\//i, "")))
    return "That does not look like a valid link.";
  if (!u.hostname.includes(".") && u.hostname !== "localhost")
    return "That does not look like a valid link.";
  return null;
}

/** A sensible default type for a link, from its address. The teacher can change it. */
export function detectType(url: string): ResourceType {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "website";
  }
  if (host === "drive.google.com") return "google_drive";
  if (
    host === "docs.google.com" ||
    host.endsWith(".sharepoint.com") ||
    host === "onedrive.live.com" ||
    host === "notion.so"
  )
    return "document";
  if (["youtube.com", "m.youtube.com", "youtu.be", "vimeo.com"].includes(host)) return "video";
  if (host.endsWith("wikipedia.org") || host.endsWith("britannica.com")) return "reference";
  return "website";
}

/** "example.com" for display. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Splits "math, grade 7" into clean tags (lower-case, no blanks, no duplicates). */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen];
}

export type ResourceInput = {
  title: string;
  url: string;
  description: string;
  type: string;
  tags: string[];
};

export function validateResource(i: ResourceInput): Errors {
  const e: Errors = {};
  const title = i.title.trim();
  if (!title) e.title = "Enter a title.";
  else if (title.length > 160) e.title = "Use 160 characters or fewer.";
  const urlError = validateUrl(i.url);
  if (urlError) e.url = urlError;
  if (i.description.trim().length > 500) e.description = "Use 500 characters or fewer.";
  if (!RESOURCE_TYPES.some((t) => t.value === i.type)) e.type = "Choose a type.";
  if (i.tags.length > MAX_TAGS) e.tags = `Use at most ${MAX_TAGS} tags.`;
  else if (i.tags.some((t) => t.length > MAX_TAG_LENGTH))
    e.tags = `Each tag can be at most ${MAX_TAG_LENGTH} characters.`;
  return e;
}

export function validateFolderName(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter a folder name.";
  if (n.length > 60) return "Use 60 characters or fewer.";
  return null;
}
