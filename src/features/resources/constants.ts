export type ResourceType =
  "website" | "google_drive" | "document" | "video" | "reference" | "other";
type Tone = "neutral" | "brand" | "info" | "success" | "warning" | "danger" | "violet";

export const RESOURCE_TYPES: { value: ResourceType; label: string; tone: Tone }[] = [
  { value: "website", label: "Website", tone: "info" },
  { value: "google_drive", label: "Google Drive", tone: "success" },
  { value: "document", label: "Online document", tone: "violet" },
  { value: "video", label: "Video", tone: "danger" },
  { value: "reference", label: "Reference", tone: "warning" },
  { value: "other", label: "Other", tone: "neutral" },
];

export const typeMeta = (v: string) =>
  RESOURCE_TYPES.find((t) => t.value === v) ?? RESOURCE_TYPES[5];

export type ResourceSort = "recent" | "oldest" | "title";
export const RESOURCE_SORTS: { value: ResourceSort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "oldest", label: "Oldest first" },
  { value: "title", label: "Title (A–Z)" },
];

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
