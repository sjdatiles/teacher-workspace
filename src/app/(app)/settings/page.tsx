import { Bell, Settings } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { AcademicYearsSection } from "@/features/academic/AcademicYearsSection";
import { PasswordForm, ProfileForm } from "@/features/auth/AuthForms";
import { NotificationForm } from "@/features/settings/NotificationForm";
import { getAcademicContext, getNotificationSettings } from "@/services/academic";
import { requireTeacher } from "@/services/teacher";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  const [academic, notifications] = await Promise.all([
    getAcademicContext(),
    getNotificationSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your academic calendar, profile and account."
        icon={Settings}
      />
      <div className="max-w-5xl space-y-6">
        <AcademicYearsSection
          years={academic.years}
          selectedId={academic.selectedYear?.id ?? null}
          currentId={academic.currentYear?.id ?? null}
          today={academic.today}
        />
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Profile" />
            <ProfileForm
              defaults={{
                email: teacher.email,
                fullName: teacher.fullName,
                jobTitle: teacher.jobTitle,
                schoolName: teacher.schoolName,
              }}
            />
          </Card>
          <Card>
            <CardHeader title="Password" />
            <PasswordForm />
          </Card>
          <Card>
            <CardHeader title="Notifications" icon={<Bell className="size-4.5" aria-hidden />} />
            <NotificationForm defaults={notifications} />
          </Card>
        </div>
      </div>
    </>
  );
}
