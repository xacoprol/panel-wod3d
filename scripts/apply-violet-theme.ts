/**
 * Apply violet + cool-neutral palette to CompanySettings.
 * Usage: npx tsx scripts/apply-violet-theme.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { DEFAULT_THEME } from "../lib/theme";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");

  const adapter = new PrismaNeonHTTP(url, {
    arrayMode: true,
    fullResults: true,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const row = await prisma.companySettings.findFirst();
    if (!row) {
      console.log("No CompanySettings row; nothing to update");
      return;
    }

    await prisma.companySettings.update({
      where: { id: row.id },
      data: { ...DEFAULT_THEME },
    });

    console.log("Theme updated to violet palette for", row.id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
