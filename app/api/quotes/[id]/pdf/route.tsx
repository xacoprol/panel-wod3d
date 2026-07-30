import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, calculateDocument } from "@/lib/calculations";
import { InvoicePdfDocument } from "@/lib/pdf/InvoiceDocument";
import React from "react";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [quote, settings] = await Promise.all([
    prisma.quote.findUnique({
      where: { id },
      include: {
        client: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!quote || !settings) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const totals = calculateDocument(
    quote.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      vatRate: l.vatRate,
      discountPct: l.discountPct,
    })),
    0,
    quote.discountPct
  );

  // Forma de cobro desde notas importadas si existe
  const paymentFromNotes = quote.notes?.match(/Forma de cobro:\s*(.+)/i)?.[1];

  const doc = (
    <InvoicePdfDocument
      title="PRESUPUESTO"
      number={quote.fullNumber}
      issueDate={formatDate(quote.issueDate)}
      dueDate={formatDate(quote.validUntil)}
      brandName={settings.companyName?.trim() || settings.name || "Empresa"}
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
        email: quote.client.email,
        phone: quote.client.phone,
      }}
      lines={quote.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        vatRate: l.vatRate,
        discountPct: l.discountPct,
        lineSubtotal: Number(l.lineSubtotal),
      }))}
      subtotal={Number(quote.subtotal)}
      vatAmount={Number(quote.vatAmount)}
      total={Number(quote.total)}
      specialDiscountPct={totals.discountPct}
      specialDiscountAmount={totals.discountAmount}
      paymentMethod={paymentFromNotes?.trim() || null}
      notes={
        [quote.notes, quote.conditions]
          .filter(Boolean)
          .join("\n")
          .replace(/Forma de cobro:\s*.+/i, "")
          .trim() || null
      }
      bankIban={settings.bankIban}
      bankName={settings.bankName}
    />
  );

  const buffer = await renderToBuffer(doc);
  const asDownload = _req.nextUrl.searchParams.get("download") === "1";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="Presupuesto_${quote.fullNumber}.pdf"`,
    },
  });
}
