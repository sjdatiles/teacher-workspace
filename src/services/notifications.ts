import { cache } from "react";
import {
  buildNotifications,
  type AppNotification,
  type DueTask,
} from "@/features/notifications/rules";
import { createClient } from "@/lib/supabase/server";
import { addDays, nowInSchool } from "@/lib/time";
import { getNotificationSettings } from "./academic";
import { getCalendarItems } from "./calendar";
import { requireTeacher } from "./teacher";

export type NotificationView = AppNotification & { read: boolean };

/**
 * The teacher's current notifications, newest-needed first. They are worked out from live records;
 * the database only remembers which ones were read or dismissed. A failure here must never take the
 * whole app down, so it returns an empty list (and logs) instead of throwing.
 */
export const getNotifications = cache(async (): Promise<NotificationView[]> => {
  try {
    const teacher = await requireTeacher();
    const supabase = await createClient();
    const [prefs, now] = [await getNotificationSettings(), nowInSchool()];
    const tomorrow = addDays(now.date, 1);

    const wantsCalendar = prefs.upcomingSessions || prefs.upcomingEvents;
    const [items, tasksRes, statesRes] = await Promise.all([
      // Reminders can be set up to a week ahead, so look a little further than that.
      wantsCalendar ? getCalendarItems(now.date, addDays(now.date, 8)) : Promise.resolve([]),
      prefs.taskDeadlines
        ? supabase
            .from("tasks")
            .select("id, title, due_date, priority")
            .eq("user_id", teacher.id)
            .neq("status", "completed")
            .not("due_date", "is", null)
            .lte("due_date", tomorrow)
            .order("due_date")
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("notification_states")
        .select("key, state")
        .eq("user_id", teacher.id)
        .limit(2000),
    ]);
    if (tasksRes.error || statesRes.error) throw new Error("query failed");

    const tasks: DueTask[] = (tasksRes.data ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      dueDate: t.due_date as string,
      priority: t.priority as string,
    }));
    const state = new Map((statesRes.data ?? []).map((s) => [s.key as string, s.state as string]));

    return buildNotifications(items, tasks, prefs, now)
      .filter((n) => state.get(n.key) !== "dismissed")
      .map((n) => ({ ...n, read: state.get(n.key) === "read" }));
  } catch (error) {
    console.error("Could not load notifications", error);
    return [];
  }
});
