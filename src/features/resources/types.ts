import type { ResourceType } from "./constants";

export type Resource = {
  id: string;
  title: string;
  url: string;
  description: string;
  type: ResourceType;
  categoryId: string | null;
  subjectId: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
};

export type Folder = { id: string; name: string; count: number };
export type SubjectOption = { id: string; label: string };
