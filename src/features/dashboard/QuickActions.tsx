import {
  BookOpen,
  CalendarClock,
  CalendarPlus,
  CheckSquare,
  GraduationCap,
  Link2,
  Users,
} from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { label: "Add Subject", href: "/classes?tab=subjects&new=1", icon: BookOpen, needsYear: true },
  { label: "Add Class Section", href: "/classes?tab=sections&new=1", icon: Users, needsYear: true },
  {
    label: "Add Teaching Schedule",
    href: "/classes?tab=schedules&new=1",
    icon: CalendarClock,
    needsYear: true,
  },
  {
    label: "Add Teaching Session",
    href: "/classes?tab=sessions&new=1",
    icon: GraduationCap,
    needsYear: true,
  },
  { label: "Add Task", href: "/tasks?new=1", icon: CheckSquare, needsYear: false },
  { label: "Add Calendar Event", href: "/calendar?new=1", icon: CalendarPlus, needsYear: false },
  { label: "Save Resource Link", href: "/resources?new=1", icon: Link2, needsYear: false },
] as const;

/** Shortcuts that open the matching "add" form directly. Class shortcuts need an academic year. */
export function QuickActions({ hasYear }: { hasYear: boolean }) {
  return (
    <nav aria-label="Quick actions" className="mb-6">
      <h2 className="text-ink-soft mb-2 text-xs font-bold tracking-wide uppercase">
        Quick actions
      </h2>
      <ul className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => hasYear || !a.needsYear).map(({ label, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="border-line bg-surface hover:bg-brand-50 hover:text-brand-700 rounded-control shadow-card inline-flex min-h-10 items-center gap-2 border px-3.5 text-sm font-semibold"
            >
              <Icon className="text-brand-600 size-4" aria-hidden /> {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
