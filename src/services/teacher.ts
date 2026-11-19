import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";

export type Teacher = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  schoolName: string;
};

/**
 * Returns the signed-in teacher (auth user + profile row) or redirects to /login.
 * Memoised per request. Every page and service starts from this so there is one
 * place that decides "who is the current teacher".
 */
export const requireTeacher = cache(async (): Promise<Teacher> => {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, job_title, school_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    fullName: profile?.full_name ?? "",
    jobTitle: profile?.job_title ?? "Teacher",
    schoolName: profile?.school_name ?? "",
  };
});
