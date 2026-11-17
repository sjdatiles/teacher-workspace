"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { friendlyDbError } from "@/lib/db-error";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { isValidISODate } from "@/lib/time";
import { allOccurrenceStarts } from "./recurrence";
import { validateEvent, type EventInput } from "./rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const fail = (message: string): FormState => ({ ok: false, errors: { form: message } });
const done = (message: string): FormState => {
  revalidatePath("/calendar");
  revalidatePath("/", "layout");
  return { ok: true, message };
};

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, userId: user.id };
}

function readInput(fd: FormData): EventInput {
  return {
    title: text(fd, "title"),
    description: text(fd, "description"),
    category: text(fd, "category"),
    color: text(fd, "color"),
    startDate: text(fd, "startDate"),
    endDate: text(fd, "endDate"),
    allDay: text(fd, "allDay") === "on",
    startTime: text(fd, "startTime"),
    endTime: text(fd, "endTime"),
    location: text(fd, "location"),
    notes: text(fd, "notes"),
    reminder: text(fd, "reminder"),
    repeatFreq: text(fd, "repeatFreq") || "none",
    repeatInterval: text(fd, "repeatInterval") || "1",
    repeatUntil: text(fd, "repeatUntil"),
  };
}

/** Create a new event, or (with id) change the whole event / every occurrence of a series. */
export async function saveEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id");
  if (id && !UUID.test(id)) return fail("Invalid event.");

  const input = readInput(fd);
  const errors = validateEvent(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const repeats = input.repeatFreq !== "none";
  const row = {
    title: input.title,
    description: input.description,
    category: input.category,
    color: input.color || null,
    start_date: input.startDate,
    end_date: input.endDate,
    start_time: input.allDay ? null : input.startTime,
    end_time: input.allDay ? null : input.endTime,
    location: input.location,
    notes: input.notes,
    reminder_minutes: input.reminder === "" ? null : Number(input.reminder),
    repeat_freq: input.repeatFreq,
    repeat_interval: repeats ? Number(input.repeatInterval) : 1,
    repeat_until: repeats ? input.repeatUntil : null,
  };

  const { supabase, userId } = await session();
  if (id) {
    const { data, error } = await supabase
      .from("calendar_events")
      .update(row)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");
    if (error) return fail(friendlyDbError(error, "Could not save the event. Please try again."));
    if ((data ?? []).length === 0) return fail("This event no longer exists.");
    return done("Event updated.");
  }
  const { error } = await supabase.from("calendar_events").insert({ ...row, user_id: userId });
  if (error) return fail(friendlyDbError(error, "Could not save the event. Please try again."));
  return done("Event added.");
}

/** Delete an event, and with it every occurrence of a repeating series. */
export async function deleteEvent(id: string): Promise<FormState> {
  if (!UUID.test(id)) return fail("Invalid event.");
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");
  if (error) return fail(friendlyDbError(error, "Could not delete the event."));
  if ((data ?? []).length === 0) return fail("This event no longer exists.");
  return done("Event deleted.");
}

/** Confirms the date really is an occurrence of the series, so stray rows cannot be created. */
async function loadOccurrenceTarget(eventId: string, occurrenceDate: string) {
  if (!UUID.test(eventId) || !isValidISODate(occurrenceDate))
    return { error: "Invalid occurrence." } as const;
  const { supabase, userId } = await session();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("start_date, repeat_freq, repeat_interval, repeat_until, end_date")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: "Could not load the event." } as const;
  if (!data) return { error: "This event no longer exists." } as const;
  const starts = allOccurrenceStarts({
    startDate: data.start_date,
    endDate: data.end_date,
    repeatFreq: data.repeat_freq,
    repeatInterval: data.repeat_interval,
    repeatUntil: data.repeat_until,
  });
  if (data.repeat_freq === "none" || !starts.includes(occurrenceDate))
    return { error: "That date is not part of this repeating event." } as const;
  return { supabase, userId } as const;
}

/** Change only one occurrence of a repeating event. */
export async function saveOccurrence(_prev: FormState, fd: FormData): Promise<FormState> {
  const eventId = text(fd, "eventId");
  const occurrenceDate = text(fd, "occurrenceDate");

  const input = readInput(fd);
  const errors = validateEvent(input, true);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const target = await loadOccurrenceTarget(eventId, occurrenceDate);
  if ("error" in target) return fail(target.error!);

  const { error } = await target.supabase.from("calendar_event_exceptions").upsert(
    {
      user_id: target.userId,
      event_id: eventId,
      occurrence_date: occurrenceDate,
      cancelled: false,
      title: input.title,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.allDay ? null : input.startTime,
      end_time: input.allDay ? null : input.endTime,
      location: input.location,
      notes: input.notes,
    },
    { onConflict: "event_id,occurrence_date" },
  );
  if (error) return fail(friendlyDbError(error, "Could not save this occurrence."));
  return done("This occurrence was updated. The rest of the series is unchanged.");
}

/** Remove one occurrence from a repeating event; the others stay. */
export async function skipOccurrence(eventId: string, occurrenceDate: string): Promise<FormState> {
  const target = await loadOccurrenceTarget(eventId, occurrenceDate);
  if ("error" in target) return fail(target.error!);
  const { error } = await target.supabase.from("calendar_event_exceptions").upsert(
    {
      user_id: target.userId,
      event_id: eventId,
      occurrence_date: occurrenceDate,
      cancelled: true,
      title: null,
      start_date: null,
      end_date: null,
      start_time: null,
      end_time: null,
      description: "",
      location: "",
      notes: "",
    },
    { onConflict: "event_id,occurrence_date" },
  );
  if (error) return fail(friendlyDbError(error, "Could not remove this occurrence."));
  return done("This occurrence was removed. The rest of the series is unchanged.");
}

/** Put a changed occurrence back to what the series says. */
export async function resetOccurrence(eventId: string, occurrenceDate: string): Promise<FormState> {
  if (!UUID.test(eventId) || !isValidISODate(occurrenceDate)) return fail("Invalid occurrence.");
  const { supabase, userId } = await session();
  const { error } = await supabase
    .from("calendar_event_exceptions")
    .delete()
    .eq("event_id", eventId)
    .eq("occurrence_date", occurrenceDate)
    .eq("user_id", userId);
  if (error) return fail(friendlyDbError(error, "Could not reset this occurrence."));
  return done("This occurrence now follows the series again.");
}
