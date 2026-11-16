import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { PasswordForm, ProfileForm } from "@/features/auth/AuthForms";
import { requireTeacher } from "@/services/teacher";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your profile and account security."
        icon={Settings}
      />
      <div className="grid max-w-5xl gap-6 xl:grid-cols-2">
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
      </div>
    </>
  );
}
