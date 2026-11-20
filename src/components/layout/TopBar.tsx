import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell, type BellItem } from "./NotificationBell";
import { UserMenu } from "./UserMenu";

export function TopBar({ name, notifications }: { name: string; notifications: BellItem[] }) {
  return (
    <header className="bg-canvas/90 sticky top-0 z-30 flex items-center gap-3 px-4 py-3 backdrop-blur sm:px-6 lg:px-8 print:hidden">
      <Link href="/" aria-label="Manunudlo home" className="lg:hidden">
        <LogoMark className="size-9" />
      </Link>
      <div className="flex-1">
        <GlobalSearch />
      </div>
      <NotificationBell items={notifications} />
      {/* Profile menu in the top bar on small screens; the sidebar hosts it on desktop. */}
      <div className="lg:hidden">
        <UserMenu name={name} compact placement="down" />
      </div>
    </header>
  );
}
