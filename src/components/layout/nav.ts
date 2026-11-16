import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckSquare,
  FolderOpen,
  Home,
  LifeBuoy,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** Shorter label for the mobile tab bar. */
  shortLabel: string;
  icon: LucideIcon;
  keywords: string[];
};

/** The six approved primary destinations (spec 3.2). Do not add without approval. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", shortLabel: "Home", icon: Home, keywords: ["dashboard", "today"] },
  {
    href: "/calendar",
    label: "Calendar & Planner",
    shortLabel: "Calendar",
    icon: CalendarDays,
    keywords: ["events", "schedule", "planner"],
  },
  {
    href: "/tasks",
    label: "Tasks & Responsibilities",
    shortLabel: "Tasks",
    icon: CheckSquare,
    keywords: ["todo", "deadlines"],
  },
  {
    href: "/classes",
    label: "My Classes",
    shortLabel: "Classes",
    icon: BookOpen,
    keywords: ["subjects", "sections", "sessions", "teaching"],
  },
  {
    href: "/resources",
    label: "Resources",
    shortLabel: "Resources",
    icon: FolderOpen,
    keywords: ["links", "materials"],
  },
  {
    href: "/reports",
    label: "Reports & Accomplishments",
    shortLabel: "Reports",
    icon: BarChart3,
    keywords: ["accomplishments", "hours", "export"],
  },
];

export const SECONDARY_NAV: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    shortLabel: "Settings",
    icon: Settings,
    keywords: ["profile", "password", "account", "academic year", "terms"],
  },
  {
    href: "/help",
    label: "Help & Support",
    shortLabel: "Help",
    icon: LifeBuoy,
    keywords: ["support", "guide"],
  },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
