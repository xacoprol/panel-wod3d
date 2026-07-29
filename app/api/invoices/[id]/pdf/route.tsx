import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/calculations";
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
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!invoice || !settings) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = (
    <InvoicePdfDocument
      title="FACTURA"
      number={invoice.fullNumber}
      issueDate={formatDate(invoice.issueDate)}
      dueDate={formatDate(invoice.dueDate)}
      status={invoice.status}
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
        name: invoice.client.name,
        nif: invoice.client.nif,
        countryCode: invoice.client.countryCode,
        addressStreet: invoice.client.addressStreet,
        addressCity: invoice.client.addressCity,
        addressProvince: invoice.client.addressProvince,
        addressZip: invoice.client.addressZip,
        addressCountry: invoice.client.addressCountry,
        email: invoice.client.email,
        phone: invoice.client.phone,
      }}
      lines={invoice.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        vatRate: l.vatRate,
        discountPct: l.discountPct,
        lineSubtotal: Number(l.lineSubtotal),
      }))}
      subtotal={Number(invoice.subtotal)}
      vatAmount={Number(invoice.vatAmount)}
      irpfRate={invoice.irpfRate}
      irpfAmount={Number(invoice.irpfAmount)}
      total={Number(invoice.total)}
      paymentMethod={invoice.paymentMethod}
      notes={invoice.notes}
      bankIban={settings.bankIban}
      bankName={settings.bankName}
    />
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Factura_${invoice.fullNumber}.pdf"`,
    },
  });
}
