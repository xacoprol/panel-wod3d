import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const take = Math.min(Number(searchParams.get("limit") ?? "12") || 12, 25);

  const items = await prisma.catalogItem.findMany({
    where: {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take,
    select: {
      id: true,
      name: true,
      description: true,
      unitPrice: true,
      vatRate: true,
      defaultDiscountPct: true,
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      unitPrice: Number(i.unitPrice),
    })),
  });
}
