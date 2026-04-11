"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Package, PenLine, Settings } from "lucide-react";

const nav = [
  { href: "/collection", label: "Collection", Icon: Layers },
  { href: "/studio", label: "Studio", Icon: PenLine },
  { href: "/packs", label: "Packs", Icon: Package },
  { href: "/settings", label: "Settings", Icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/collection") {
    return pathname === "/collection" || pathname.startsWith("/collection/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 z-30 flex min-h-[56px] justify-around border-t border-[var(--tc-border)] bg-[color-mix(in_srgb,var(--tc-surface-elevated)_88%,transparent)] py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md supports-[backdrop-filter]:bg-[var(--tc-surface-elevated)]"
    >
      {nav.map((n) => {
        const active = isActive(pathname, n.href);
        const Icon = n.Icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)] ${
              active
                ? "bg-[var(--tc-surface-muted)] text-[var(--tc-accent)]"
                : "text-[var(--tc-text-muted)] hover:bg-[var(--tc-surface-hover)] hover:text-[var(--tc-accent-hover)]"
            }`}
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${active ? "opacity-100" : "opacity-80"}`}
              strokeWidth={active ? 2.25 : 1.75}
              aria-hidden
            />
            <span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
