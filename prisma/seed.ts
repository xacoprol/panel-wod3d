import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Fecha local a mediodía para evitar desfases UTC en SQLite/Date */
function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

async function main() {
  const email = process.env.SEED_EMAIL ?? "admin@factura.local";
  const password = process.env.SEED_PASSWORD ?? "admin123";

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      name: "Administrador",
      passwordHash,
    },
  });

  const year = new Date().getFullYear();

  const invoiceSeries = await prisma.invoiceSeries.upsert({
    where: { prefix: "A-" },
    update: {},
    create: {
      prefix: "A-",
      name: "Serie general",
      nextNumber: 1,
      year,
      padLength: 3,
      isDefault: true,
    },
  });

  await prisma.quoteSeries.upsert({
    where: { prefix: "PRE-" },
    update: {},
    create: {
      prefix: "PRE-",
      name: "Presupuestos",
      nextNumber: 1,
      year,
      padLength: 3,
      isDefault: true,
    },
  });

  const existingSettings = await prisma.companySettings.findFirst();
  if (!existingSettings) {
    await prisma.companySettings.create({
      data: {
        name: "Mi Empresa S.L.",
        nif: "12345678Z",
        addressStreet: "Calle Ejemplo 1",
        addressCity: "Madrid",
        addressProvince: "Madrid",
        addressZip: "28001",
        addressCountry: "España",
        email: email,
        phone: "",
        defaultVatRate: 21,
        defaultIrpfRate: 15,
        bankIban: "ES0302390806740024685729",
        bankName: "Transferencia",
      },
    });
  }

  // ── Caso real: Ritmos Fascinantes Lda (PT) + hosting anual exento ───────
  const ritmosNif = "516327372";
  let ritmos = await prisma.client.findFirst({
    where: { nif: ritmosNif },
  });

  if (!ritmos) {
    ritmos = await prisma.client.findFirst({
      where: { name: "Ritmos Fascinantes Lda" },
    });
  }

  if (ritmos) {
    ritmos = await prisma.client.update({
      where: { id: ritmos.id },
      data: {
        name: "Ritmos Fascinantes Lda",
        nif: ritmosNif,
        countryCode: "PT",
        addressStreet: "Rua D.Frei João De Faro Nr. 58 3º",
        addressCity: "FARO",
        addressProvince: "Faro",
        addressZip: "8000-349",
        addressCountry: "Portugal",
      },
    });
  } else {
    ritmos = await prisma.client.create({
      data: {
        name: "Ritmos Fascinantes Lda",
        nif: ritmosNif,
        countryCode: "PT",
        addressStreet: "Rua D.Frei João De Faro Nr. 58 3º",
        addressCity: "FARO",
        addressProvince: "Faro",
        addressZip: "8000-349",
        addressCountry: "Portugal",
      },
    });
  }

  const templateName = "Hosting + dominio belluxentertainment.com";
  let template = await prisma.recurringInvoiceTemplate.findFirst({
    where: { clientId: ritmos.id, name: templateName },
    include: { lines: true },
  });

  const templateData = {
    name: templateName,
    clientId: ritmos.id,
    seriesId: invoiceSeries.id,
    frequency: "ANUAL",
    intervalCount: 1,
    dayOfMonth: 1,
    startDate: localDate("2021-06-01"),
    endDate: localDate("2040-06-01"),
    status: "ACTIVA",
    paymentMethod: "Transferencia",
    bankIban: "ES0302390806740024685729",
    irpfRate: 0,
    vatOperationType: "EXENTA",
    cashAccounting: false,
    operationKey: "0 - Operación habitual",
    operationKey347:
      "B - Ventas: Entregas de bienes y prestaciones de servicios superiores a 3.005,06 euros",
    // Próxima a generar: 2026-06-01 (caso de prueba del cron)
    nextRunDate: localDate("2026-06-01"),
    notes: "Ventas exentas de IVA · Hosting/dominio anual belluxentertainment.com",
  };

  const linesData = [
    {
      sortOrder: 0,
      description: "Hosting belluxentertainment.com",
      quantity: 1,
      unitPrice: 70,
      vatRate: 0,
      discountPct: 0,
    },
    {
      sortOrder: 1,
      description: "Dominio .com | belluxentertainment.com",
      quantity: 1,
      unitPrice: 20,
      vatRate: 0,
      discountPct: 0,
    },
  ];

  if (template) {
    await prisma.recurringLine.deleteMany({ where: { templateId: template.id } });
    template = await prisma.recurringInvoiceTemplate.update({
      where: { id: template.id },
      data: {
        ...templateData,
        lines: { create: linesData },
      },
      include: { lines: true },
    });
  } else {
    template = await prisma.recurringInvoiceTemplate.create({
      data: {
        ...templateData,
        lines: { create: linesData },
      },
      include: { lines: true },
    });
  }

  console.log("Seed OK");
  console.log(`  Usuario: ${email} / ${password}`);
  console.log(`  Serie factura: ${invoiceSeries.prefix}${year}-001`);
  console.log(`  Cliente PT: ${ritmos.name} (${ritmos.nif})`);
  console.log(
    `  Plantilla: ${template.name} · nextRun=${template.nextRunDate?.toISOString().slice(0, 10)} · EXENTA · 90€`
  );
  console.log(
    "  Probar cron: curl -H \"Authorization: Bearer $CRON_SECRET\" \"http://localhost:3000/api/cron/generate-recurring-invoices?date=2026-06-01\""
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
