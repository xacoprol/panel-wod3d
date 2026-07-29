/**
 * Crea presupuesto Maison Gooming SLU con desglose por horas a 60 €/h.
 * Usage: npx tsx scripts/create-maison-quote.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { calculateDocument } from "../lib/calculations";

const RATE = 60;
const VAT = 21;

/** Cantidad = horas, precio = €/h */
const LINES: { description: string; hours: number }[] = [
  // Plataforma / software (220 h)
  { description: "Análisis funcional de la plataforma", hours: 15 },
  { description: "Diseño de la experiencia de usuario (plataforma)", hours: 20 },
  { description: "Desarrollo frontend de la plataforma", hours: 35 },
  { description: "Desarrollo backend de la plataforma", hours: 40 },
  { description: "Desarrollo de área de clientes / gestión de clientes", hours: 15 },
  { description: "Calendario de reservas online", hours: 18 },
  { description: "Gestión de disponibilidad", hours: 12 },
  { description: "Desarrollo del sistema MV Care y fichas/historial de mascotas", hours: 20 },
  { description: "Integración de WhatsApp y automatizaciones", hours: 12 },
  { description: "Sistema de notificaciones y recordatorios automáticos", hours: 10 },
  { description: "Panel de administración", hours: 13 },
  { description: "Pruebas y depuración de la plataforma", hours: 10 },
  // Desarrollo web (80 h)
  { description: "Desarrollo de la página web", hours: 35 },
  { description: "Diseño UX/UI de la web", hours: 20 },
  { description: "Optimización SEO", hours: 10 },
  { description: "Configuración de Google Business", hours: 5 },
  { description: "Configuración de analítica y rendimiento", hours: 5 },
  { description: "Redacción de textos comerciales", hours: 5 },
  // Branding (35 h)
  { description: "Estudio de marca y posicionamiento", hours: 5 },
  { description: "Diseño de identidad corporativa Maison Vigo", hours: 8 },
  { description: "Manual de imagen y aplicaciones de marca", hours: 6 },
  { description: "Diseño del logotipo y variantes", hours: 8 },
  { description: "Dirección creativa del proyecto", hours: 8 },
  // Diseño del local (40 h)
  { description: "Diseño del interior del local", hours: 12 },
  { description: "Diseño de fachada y escaparate", hours: 10 },
  { description: "Diseño de señalética interior y exterior", hours: 8 },
  { description: "Diseño de expositores y merchandising", hours: 10 },
  // Renders e IA (50 h)
  { description: "Renders y visualizaciones 3D", hours: 35 },
  { description: "Diseño de joyería personalizada", hours: 15 },
  // Fotografía y edición (25 h)
  { description: "Edición y retoque fotográfico", hours: 12 },
  { description: "Creación de contenido para redes sociales", hours: 8 },
  { description: "Dirección artística de fotografías", hours: 5 },
  // Dossiers y material impreso (25 h)
  { description: "Diseño de dossier MV Home", hours: 8 },
  { description: "Diseño de díptico MV Care", hours: 6 },
  { description: "Diseño de lista de precios", hours: 4 },
  { description: "Diseño de cartelería y metacrilatos", hours: 7 },
  // Estrategia, reuniones y revisiones (60 h)
  { description: "Consultoría estratégica", hours: 15 },
  { description: "Reuniones de planificación", hours: 15 },
  { description: "Desarrollo de nuevos servicios", hours: 10 },
  { description: "Pruebas, revisiones e iteraciones", hours: 10 },
  { description: "Soporte técnico y mantenimiento durante el desarrollo", hours: 10 },
];

async function main() {
  const hours = LINES.reduce((s, l) => s + l.hours, 0);
  if (hours !== 535) {
    throw new Error(`Horas totales ${hours} ≠ 535 (220+80+35+40+50+25+25+60)`);
  }

  const adapter = new PrismaNeonHTTP(process.env.DATABASE_URL!, {
    arrayMode: true,
    fullResults: true,
  });
  const prisma = new PrismaClient({ adapter });

  let client = await prisma.client.findFirst({
    where: { name: { contains: "Maison Gooming", mode: "insensitive" } },
  });
  if (!client) {
    client = await prisma.client.create({
      data: {
        name: "Maison Gooming SLU",
        nif: "PENDIENTE",
        countryCode: "ES",
        addressStreet: "Pendiente",
        addressCity: "Vigo",
        addressProvince: "Pontevedra",
        addressZip: "36200",
        addressCountry: "España",
        notes: "Datos fiscales pendientes de completar",
      },
    });
    console.log("Cliente creado:", client.id);
  } else {
    console.log("Cliente existente:", client.id);
  }

  const series = await prisma.quoteSeries.findFirstOrThrow({
    where: { isDefault: true },
  });
  const number = series.nextNumber;
  const fullNumber = `${series.prefix}${String(number).padStart(series.padLength, "0")}`;

  const inputs = LINES.map((l) => ({
    description: `${l.description} (${l.hours} h)`,
    quantity: l.hours,
    unitPrice: RATE,
    vatRate: VAT,
    discountPct: 0,
  }));
  const totals = calculateDocument(inputs);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 30);

  await prisma.quoteSeries.update({
    where: { id: series.id },
    data: { nextNumber: number + 1 },
  });

  const quote = await prisma.quote.create({
    data: {
      seriesId: series.id,
      seriesPrefix: series.prefix,
      number,
      fullNumber,
      clientId: client.id,
      issueDate: today,
      validUntil,
      status: "BORRADOR",
      notes:
        "Desglose por horas de trabajo a 60 €/h. Refleja branding, diseño de local, desarrollo web y plataforma de software (reservas, MV Care, automatizaciones).",
      conditions:
        "Presupuesto válido 30 días. Datos del cliente pendientes de completar.",
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
    },
  });

  for (const l of totals.lines) {
    await prisma.quoteLine.create({
      data: {
        quoteId: quote.id,
        sortOrder: l.sortOrder,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        vatRate: l.vatRate,
        discountPct: l.discountPct,
        lineSubtotal: l.lineSubtotal,
        lineVat: l.lineVat,
        lineTotal: l.lineTotal,
      },
    });
  }

  console.log("Presupuesto creado:", fullNumber, quote.id);
  console.log(
    `  ${hours} h × ${RATE} €/h = ${totals.subtotal.toFixed(2)} € + IVA ${totals.vatAmount.toFixed(2)} € = ${totals.total.toFixed(2)} €`
  );
  console.log(`  /quotes/${quote.id}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
