/** One row of completed_session_report(): completed sessions of one subject + section in one term. */
export type ReportRow = {
  term: 1 | 2 | 3;
  subjectId: string;
  sectionId: string;
  sessions: number;
  minutes: number;
  students: number;
};

export type Totals = { sessions: number; minutes: number; students: number };
