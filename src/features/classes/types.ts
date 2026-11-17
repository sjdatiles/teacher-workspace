import type { SessionStatus } from "./constants";

export type Subject = {
  id: string;
  name: string;
  code: string;
  gradeLevel: string;
  description: string;
  sectionIds: string[];
};

export type Section = {
  id: string;
  name: string;
  gradeLevel: string;
  population: number;
  description: string;
  subjectIds: string[];
};

export type Schedule = {
  id: string;
  subjectId: string;
  sectionId: string;
  dayOfWeek: number;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  effectiveStart: string;
  effectiveEnd: string;
  termNumbers: number[];
};

export type NoClassDay = { id: string; dateFrom: string; dateTo: string; reason: string };

export type Session = {
  id: string;
  subjectId: string;
  sectionId: string;
  scheduleId: string | null;
  origin: "generated" | "manual" | "rescheduled";
  date: string;
  startTime: string;
  endTime: string;
  scheduledMinutes: number;
  status: SessionStatus;
  actualMinutes: number | null;
  termNumber: number;
  rescheduledFromId: string | null;
  hasReplacement: boolean;
  notes: string;
};
