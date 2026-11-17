import type { TaskCategory, TaskPriority, TaskStatus } from "./constants";

export type Task = {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  notes: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
