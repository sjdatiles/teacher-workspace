"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAcademicContext } from "@/services/academic";
import type { FormState } from "@/lib/form-state";
import { friendlyDbError } from "@/lib/db-error";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/time";
import {
  findScheduleConflicts,
  formatTimeRange,
  validateActualMinutes,
  validateManualSession,
  validateNoClassDay,
  validateReschedule,
  validateSchedule,
  validateSection,
  validateSubject,
  type YearBounds,
} from "./rules";
import { dayLabel } from "./constants";
import type { Schedule } from "./types";
import { getAuthUser } from "@/lib/supabase/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v: string) => UUID.test(v);

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const fail = (message: string): FormState => ({ ok: false, errors: { form: message } });
const done = (message: string): FormState => {
  revalidatePath("/classes");
  revalidatePath("/", "layout");
  return { ok: true, message };
};

async function session() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

/** The academic year being viewed, with its term dates. Every write targets this year. */
async function viewedYear(): Promise<{ id: string; bounds: YearBounds } | null> {
  const { selectedYear } = await getAcademicContext();
  if (!selectedYear) return null;
  return { id: selectedYear.id, bounds: selectedYear };
}

const NO_YEAR = "Set up an academic year first (Settings → Academic years).";

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------
export async function saveSubject(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !isId(id)) return fail("Invalid subject.");
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);

  const input = {
    name: text(fd, "name"),
    code: text(fd, "code"),
    gradeLevel: text(fd, "gradeLevel"),
    description: text(fd, "description"),
  };
  const errors = validateSubject(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const sectionIds = fd.getAll("sectionIds").map(String).filter(isId);
  const { supabase } = await session();
  const { error } = await supabase.rpc("save_subject", {
    p_id: id || null,
    p_year_id: year.id,
    p_name: input.name,
    p_code: input.code,
    p_grade: input.gradeLevel,
    p_description: input.description,
    p_section_ids: sectionIds,
  });
  if (error) {
    if (error.code === "23505")
      return { ok: false, errors: { name: "You already have this subject for that grade level." } };
    if (error.code === "23503")
      return fail(
        "A section you removed still has a schedule or sessions for this subject. Delete that schedule first.",
      );
    return fail(friendlyDbError(error, "Could not save the subject. Please try again."));
  }
  return done(id ? "Subject updated." : "Subject added.");
}

export async function deleteSubject(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid subject.");
  const { supabase } = await session();
  const { error } = await supabase.rpc("delete_subject", { p_id: id });
  if (error) return fail(friendlyDbError(error, "Could not delete the subject."));
  return done("Subject deleted.");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
export async function saveSection(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !isId(id)) return fail("Invalid section.");
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);

  const input = {
    name: text(fd, "name"),
    gradeLevel: text(fd, "gradeLevel"),
    population: text(fd, "population"),
    description: text(fd, "description"),
  };
  const errors = validateSection(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { supabase, userId } = await session();
  const row = {
    name: input.name,
    grade_level: input.gradeLevel,
    population: Number(input.population),
    description: input.description,
  };
  const res = id
    ? await supabase
        .from("class_sections")
        .update(row)
        .eq("id", id)
        .eq("user_id", userId)
        .eq("academic_year_id", year.id)
        .select("id")
    : await supabase
        .from("class_sections")
        .insert({ ...row, user_id: userId, academic_year_id: year.id })
        .select("id");

  if (res.error) {
    if (res.error.code === "23505")
      return { ok: false, errors: { name: "You already have this section for that grade level." } };
    return fail(friendlyDbError(res.error, "Could not save the section. Please try again."));
  }
  if (id && (res.data ?? []).length === 0) return fail("This section no longer exists.");
  return done(id ? "Section updated." : "Section added.");
}

export async function deleteSection(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid section.");
  const { supabase } = await session();
  const { error } = await supabase.rpc("delete_section", { p_id: id });
  if (error) return fail(friendlyDbError(error, "Could not delete the section."));
  return done("Section deleted.");
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------
async function loadSchedules(yearId: string): Promise<Schedule[] | null> {
  const { supabase, userId } = await session();
  const res = await supabase
    .from("teaching_schedules")
    .select(
      "id, subject_id, section_id, day_of_week, start_time, end_time, duration_minutes, effective_start, effective_end, term_numbers",
    )
    .eq("user_id", userId)
    .eq("academic_year_id", yearId);
  if (res.error) return null;
  return (res.data ?? []).map((s) => ({
    id: s.id,
    subjectId: s.subject_id,
    sectionId: s.section_id,
    dayOfWeek: s.day_of_week,
    startTime: String(s.start_time).slice(0, 5),
    endTime: String(s.end_time).slice(0, 5),
    durationMinutes: s.duration_minutes,
    effectiveStart: s.effective_start,
    effectiveEnd: s.effective_end,
    termNumbers: s.term_numbers,
  }));
}

export async function saveSchedule(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !isId(id)) return fail("Invalid schedule.");
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);

  const input = {
    subjectId: text(fd, "subjectId"),
    sectionId: text(fd, "sectionId"),
    dayOfWeek: Number(text(fd, "dayOfWeek")),
    startTime: text(fd, "startTime"),
    endTime: text(fd, "endTime"),
    effectiveStart: text(fd, "effectiveStart"),
    effectiveEnd: text(fd, "effectiveEnd"),
    termNumbers: fd.getAll("termNumbers").map(Number),
  };
  const errors = validateSchedule(input, year.bounds);
  if (input.subjectId && !isId(input.subjectId)) errors.subjectId = "Choose a subject.";
  if (input.sectionId && !isId(input.sectionId)) errors.sectionId = "Choose a section.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const existing = await loadSchedules(year.id);
  if (!existing) return fail("Could not check your other schedules. Please try again.");
  const { duplicates, overlaps } = findScheduleConflicts(input, existing, id || undefined);

  // An exact duplicate is refused outright.
  if (duplicates.length > 0) {
    return fail(
      "This exact schedule already exists (same subject, section, day and time for the same period).",
    );
  }
  // An overlap with a different class is a warning: the teacher may confirm and save anyway.
  if (overlaps.length > 0 && text(fd, "confirm") !== "1") {
    return {
      ok: false,
      errors: {},
      warnings: overlaps.map(
        (o) =>
          `Overlaps another class on ${dayLabel(o.dayOfWeek)}, ${formatTimeRange(o.startTime, o.endTime)}.`,
      ),
    };
  }

  const { supabase } = await session();
  const { data, error } = await supabase.rpc("save_teaching_schedule", {
    p_id: id || null,
    p_subject_id: input.subjectId,
    p_section_id: input.sectionId,
    p_day: input.dayOfWeek,
    p_start: input.startTime,
    p_end: input.endTime,
    p_eff_start: input.effectiveStart,
    p_eff_end: input.effectiveEnd,
    p_terms: input.termNumbers,
  });
  if (error) return fail(friendlyDbError(error, "Could not save the schedule. Please try again."));

  const generated = (data as { generated?: number } | null)?.generated ?? 0;
  return done(
    id
      ? `Schedule updated. Upcoming sessions were refreshed (${generated} created); past sessions were left as they are.`
      : `Schedule saved. ${generated} teaching session${generated === 1 ? "" : "s"} created.`,
  );
}

export async function deleteSchedule(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid schedule.");
  const { supabase } = await session();
  const { error } = await supabase.rpc("delete_teaching_schedule", { p_id: id });
  if (error) return fail(friendlyDbError(error, "Could not delete the schedule."));
  return done("Schedule deleted. Completed and past records were kept.");
}

// ---------------------------------------------------------------------------
// No-class days
// ---------------------------------------------------------------------------
export async function addNoClassDay(_prev: FormState, fd: FormData): Promise<FormState> {
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);
  const input = {
    dateFrom: text(fd, "dateFrom"),
    dateTo: text(fd, "dateTo"),
    reason: text(fd, "reason"),
  };
  const errors = validateNoClassDay(input, year.bounds);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { supabase } = await session();
  const { error } = await supabase.rpc("add_no_class_day", {
    p_year_id: year.id,
    p_from: input.dateFrom,
    p_to: input.dateTo,
    p_reason: input.reason,
  });
  if (error) return fail(friendlyDbError(error, "Could not save the no-class day."));
  return done("No-class day added. Planned sessions on those dates were removed.");
}

export async function removeNoClassDay(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid no-class day.");
  const { supabase } = await session();
  const { data, error } = await supabase.rpc("remove_no_class_day", { p_id: id });
  if (error) return fail(friendlyDbError(error, "Could not remove the no-class day."));
  const n = Number(data ?? 0);
  return done(`No-class day removed. ${n} session${n === 1 ? "" : "s"} restored.`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
export async function createManualSession(_prev: FormState, fd: FormData): Promise<FormState> {
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);
  const today = todayISO();

  const input = {
    subjectId: text(fd, "subjectId"),
    sectionId: text(fd, "sectionId"),
    date: text(fd, "date"),
    startTime: text(fd, "startTime"),
    endTime: text(fd, "endTime"),
    markCompleted: text(fd, "markCompleted") === "on",
    actualMinutes: text(fd, "actualMinutes"),
  };
  const errors = validateManualSession(input, year.bounds, today);
  if (input.subjectId && !isId(input.subjectId)) errors.subjectId = "Choose a subject.";
  if (input.sectionId && !isId(input.sectionId)) errors.sectionId = "Choose a section.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { supabase, userId } = await session();
  const { error } = await supabase.from("teaching_sessions").insert({
    user_id: userId,
    academic_year_id: year.id,
    subject_id: input.subjectId,
    section_id: input.sectionId,
    origin: "manual",
    session_date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    status: input.markCompleted ? "completed" : "scheduled",
    actual_minutes: input.markCompleted && input.actualMinutes ? Number(input.actualMinutes) : null,
    notes: text(fd, "notes"),
  });
  if (error) {
    if (error.code === "23503")
      return {
        ok: false,
        errors: {
          sectionId: "This subject is not assigned to that section. Assign it from Subjects first.",
        },
      };
    return fail(friendlyDbError(error, "Could not save the session. Please try again."));
  }
  return done(input.markCompleted ? "Session recorded as Completed." : "Session added.");
}

async function updateSession(
  id: string,
  patch: Record<string, unknown>,
  success: string,
  fallback: string,
): Promise<FormState> {
  if (!isId(id)) return fail("Invalid session.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("teaching_sessions")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, fallback));
  if ((data ?? []).length === 0) return fail("This session no longer exists.");
  return done(success);
}

/** Mark a Scheduled session Completed. actualMinutes empty = same as scheduled. */
export async function completeSession(id: string, actualMinutes: string): Promise<FormState> {
  if (actualMinutes.trim() !== "") {
    const err = validateActualMinutes(actualMinutes);
    if (err) return fail(err);
  }
  return updateSession(
    id,
    { status: "completed", actual_minutes: actualMinutes.trim() ? Number(actualMinutes) : null },
    "Session marked Completed.",
    "Could not complete the session.",
  );
}

/** Change the taught duration of an already Completed session. */
export async function updateActualMinutes(id: string, actualMinutes: string): Promise<FormState> {
  const err = validateActualMinutes(actualMinutes);
  if (err) return fail(err);
  return updateSession(
    id,
    { actual_minutes: Number(actualMinutes) },
    "Teaching duration updated.",
    "Could not update the duration.",
  );
}

export async function cancelSession(id: string): Promise<FormState> {
  return updateSession(
    id,
    { status: "cancelled" },
    "Session cancelled.",
    "Could not cancel the session.",
  );
}

/** Back to Scheduled from Completed or Cancelled. */
export async function reopenSession(id: string): Promise<FormState> {
  return updateSession(
    id,
    { status: "scheduled" },
    "Session reopened as Scheduled.",
    "Could not reopen the session.",
  );
}

export async function rescheduleSession(
  id: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<FormState> {
  if (!isId(id)) return fail("Invalid session.");
  const year = await viewedYear();
  const errors = validateReschedule({ date, startTime, endTime }, year?.bounds ?? null);
  const first = Object.values(errors)[0];
  if (first) return fail(first);

  const { supabase } = await session();
  const { error } = await supabase.rpc("reschedule_session", {
    p_session_id: id,
    p_date: date,
    p_start: startTime,
    p_end: endTime,
  });
  if (error) return fail(friendlyDbError(error, "Could not reschedule the session."));
  return done("Session rescheduled. The original is kept and is not counted.");
}

export async function undoReschedule(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid session.");
  const { supabase } = await session();
  const { error } = await supabase.rpc("undo_reschedule", { p_original_id: id });
  if (error) return fail(friendlyDbError(error, "Could not undo the reschedule."));
  return done("Reschedule undone. The session is Scheduled again.");
}

/** Mark many past Scheduled sessions Completed at once (default duration = scheduled). */
export async function bulkCompleteSessions(ids: string[]): Promise<FormState> {
  const valid = ids.filter(isId);
  if (valid.length === 0) return fail("Select at least one session.");
  if (valid.length > 200) return fail("Select 200 sessions or fewer at a time.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("teaching_sessions")
    .update({ status: "completed" })
    .in("id", valid)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .lte("session_date", todayISO())
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not complete the selected sessions."));
  const n = (data ?? []).length;
  return done(`${n} session${n === 1 ? "" : "s"} marked Completed.`);
}

/** Only manually added sessions can be deleted; generated ones are cancelled or rescheduled. */
export async function deleteManualSession(id: string): Promise<FormState> {
  if (!isId(id)) return fail("Invalid session.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("teaching_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .eq("origin", "manual")
    .neq("status", "completed")
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not delete the session."));
  if ((data ?? []).length === 0)
    return fail("Only manually added sessions that are not Completed can be deleted.");
  return done("Session deleted.");
}

// ---------------------------------------------------------------------------
// Copy classes from another year
// ---------------------------------------------------------------------------
export async function copyFromYear(fromYearId: string): Promise<FormState> {
  if (!isId(fromYearId)) return fail("Choose an academic year to copy from.");
  const year = await viewedYear();
  if (!year) return fail(NO_YEAR);
  const { supabase } = await session();
  const { data, error } = await supabase.rpc("copy_year_classes", {
    p_from: fromYearId,
    p_to: year.id,
  });
  if (error) return fail(friendlyDbError(error, "Could not copy from that year."));
  const r = (data ?? {}) as { subjects?: number; sections?: number; assignments?: number };
  return done(
    `Copied ${r.subjects ?? 0} subject(s), ${r.sections ?? 0} section(s) and ${r.assignments ?? 0} assignment(s). Schedules and sessions are not copied.`,
  );
}
