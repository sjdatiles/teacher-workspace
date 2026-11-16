import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { requireTeacher } from "@/services/teacher";

/** Authenticated shell: persistent sidebar (desktop), tab bar (mobile), top bar. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  const displayName = teacher.fullName || teacher.email;

  return (
    <div className="flex min-h-dvh">
      <Sidebar name={displayName} jobTitle={teacher.jobTitle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar name={displayName} />
        <main id="main" className="flex-1 px-4 pt-2 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
