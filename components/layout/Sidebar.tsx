"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clientes" },
  { href: "/quotes", label: "Presupuestos" },
  { href: "/invoices", label: "Facturas" },
  { href: "/recurring", label: "Recurrentes" },
  { href: "/settings", label: "Ajustes" },
];

export function Sidebar({ companyName }: { companyName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-text">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-white">
          VEXO
        </p>
        <p className="mt-1 truncate text-xs text-white/50">{companyName || "Mi empresa"}</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/65 hover:bg-white/8 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 text-xs text-white/40">
        VEXO
      </div>
    </aside>
  );
}
