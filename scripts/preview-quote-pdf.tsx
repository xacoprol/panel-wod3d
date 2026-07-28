import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import { InvoicePdfDocument } from "../lib/pdf/InvoiceDocument";
import { PrismaClient } from "@prisma/client";
import { formatDate } from "../lib/calculations";

async function main() {
  const prisma = new PrismaClient();
  const quote = await prisma.quote.findFirst({
    where: { fullNumber: "W3D260113" },
    include: { client: true, lines: { orderBy: { sortOrder: "asc" } } },
  });
  const settings = await prisma.companySettings.findFirst();
  if (!quote || !settings) throw new Error("missing quote/settings");

  const doc = (
    <InvoicePdfDocument
      title="PRESUPUESTO"
      number={quote.fullNumber}
      issueDate={formatDate(quote.issueDate)}
      brandName="WOD3D"
      logoUrl={settings.logoUrl}
      issuer={{
        name: settings.name,
        nif: settings.nif,
        addressStreet: settings.addressStreet,
        addressCity: settings.addressCity,
        addressProvince: settings.addressProvince,
        addressZip: settings.addressZip,
        addressCountry: settings.addressCountry,
        email: settings.email,
        phone: settings.phone,
      }}
      client={{
        name: quote.client.name,
        nif: quote.client.nif,
        countryCode: quote.client.countryCode,
        addressStreet: quote.client.addressStreet,
        addressCity: quote.client.addressCity,
        addressProvince: quote.client.addressProvince,
        addressZip: quote.client.addressZip,
        addressCountry: quote.client.addressCountry,
      }}
      lines={quote.lines.map((l) => ({
        description:
          l.description ===
          "Concepto importado (detalle de líneas no disponible en el listado)"
            ? "Llaveros corporativos PLA · 3 COLORES"
            : l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        vatRate: 0,
        discountPct: l.discountPct,
        lineSubtotal: Number(l.lineSubtotal),
      }))}
      subtotal={Number(quote.subtotal)}
      vatAmount={0}
      total={Number(quote.total)}
      paymentMethod="CONTADO"
      notes="Operación exenta de IVA. Entrega intracomunitaria de bienes. Art. 25 Ley 37/1992."
    />
  );

  const buf = await renderToBuffer(doc);
  writeFileSync("tmp-generated-quote.pdf", buf);
  console.log("Wrote tmp-generated-quote.pdf", buf.length, "bytes");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
