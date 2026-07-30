import { Suspense } from "react";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";

function SignOutForm({ className }: { className?: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className={className ?? "btn-ghost text-xs"}>
        Cerrar sesión
      </button>
    </form>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();
  let companyName = "";
  try {
    const settings = await prisma.companySettings.findFirst();
    companyName =
      settings?.companyName?.trim() || settings?.name?.trim() || "";
  } catch {
    companyName = "";
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <Sidebar
        companyName={companyName}
        signOutSlot={<SignOutForm className="btn-ghost px-2 py-1 text-xs" />}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end border-b border-line px-6 py-3 lg:flex">
          <SignOutForm />
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}

