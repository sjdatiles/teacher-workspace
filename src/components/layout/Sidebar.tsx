"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PRIMARY_NAV, SECONDARY_NAV, isActive, type NavItem } from "./nav";
import { UserMenu } from "./UserMenu";

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "rounded-control flex h-11 items-center gap-3 px-3.5 text-sm font-semibold transition-colors",
        active
          ? "bg-brand-500 shadow-card text-white"
          : "text-ink-soft hover:bg-brand-100/60 hover:text-ink",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar({ name, jobTitle }: { name: string; jobTitle: string }) {
  const pathname = usePathname();
  return (
    <aside className="border-line bg-sidebar sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r lg:flex print:hidden">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" aria-label="Teacher Workspace home">
          <Logo />
        </Link>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="border-line space-y-1 border-t px-3 py-3">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <UserMenu name={name} jobTitle={jobTitle} placement="up" />
      </div>
    </aside>
  );
}
