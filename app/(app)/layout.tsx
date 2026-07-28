import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  let companyName = "";
  try {
    const settings = await prisma.companySettings.findFirst();
    companyName = settings?.name ?? "";
  } catch {
    companyName = "";
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar companyName={companyName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-line px-6 py-3">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="btn-ghost text-xs">
              Cerrar sesión
            </button>
          </form>
        </header>
        <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
