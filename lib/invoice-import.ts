/**
 * Resolución de serie y cliente para importar facturas emitidas históricas.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeTaxId } from "@/lib/nif";

type Db = PrismaClient | Prisma.TransactionClient;

export type ResolvedInvoiceNumber = {
  seriesId: string;
  seriesPrefix: string;
  number: number;
  fullNumber: string;
};

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intenta encajar fullNumber en una serie existente (prefijo más largo).
 * Conserva el fullNumber tal cual para el documento mostrado.
 */
export async function resolveHistoricalInvoiceNumber(
  tx: Db,
  fullNumberRaw: string,
  preferredSeriesId?: string | null
): Promise<ResolvedInvoiceNumber> {
  const fullNumber = fullNumberRaw.trim().replace(/\s+/g, "");
  if (!fullNumber) {
    throw new Error("El número de factura es obligatorio para el histórico");
  }

  const seriesList = await tx.invoiceSeries.findMany({
    orderBy: { prefix: "desc" },
  });
  if (!seriesList.length) {
    throw new Error("No hay series de factura configuradas");
  }

  const preferred = preferredSeriesId
    ? seriesList.find((s) => s.id === preferredSeriesId)
    : null;

  const upper = fullNumber.toUpperCase();
  const byPrefix = [...seriesList]
    .filter((s) => upper.startsWith(s.prefix.toUpperCase()))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  const series =
    preferred ??
    byPrefix[0] ??
    seriesList.find((s) => s.isDefault) ??
    seriesList[0];

  const prefix = series.prefix;
  const rest = upper.startsWith(prefix.toUpperCase())
    ? fullNumber.slice(prefix.length)
    : fullNumber;

  // Formato con año: PREFIX2026-001 o PREFIX2026-1
  const withYear = /^(\d{4})-(\d+)$/.exec(rest);
  if (withYear) {
    return {
      seriesId: series.id,
      seriesPrefix: prefix,
      number: parseInt(withYear[2], 10),
      fullNumber,
    };
  }

  // Solo dígitos tras el prefijo (W3D260113 → 260113)
  const digitsOnly = /^(\d+)$/.exec(rest);
  if (digitsOnly) {
    return {
      seriesId: series.id,
      seriesPrefix: prefix,
      number: parseInt(digitsOnly[1], 10),
      fullNumber,
    };
  }

  // Último bloque de dígitos
  const trailing = /(\d+)\s*$/.exec(fullNumber);
  if (trailing) {
    return {
      seriesId: series.id,
      seriesPrefix: prefix,
      number: parseInt(trailing[1], 10),
      fullNumber,
    };
  }

  throw new Error(
    `No se pudo extraer el correlativo de «${fullNumber}». Indica un número con dígitos.`
  );
}

export type ClientResolveInput = {
  name: string;
  nif?: string | null;
  countryCode?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressZip?: string | null;
  addressCountry?: string | null;
  email?: string | null;
};

/**
 * Busca cliente por NIF o nombre; si no existe, lo crea con datos mínimos.
 */
export async function resolveOrCreateClient(
  tx: Db,
  input: ClientResolveInput
): Promise<{ clientId: string; created: boolean }> {
  const name = input.name.trim();
  if (!name) throw new Error("El cliente es obligatorio");

  const nifRaw = input.nif ? normalizeTaxId(input.nif) : "";
  const countryCode =
    (input.countryCode ?? "ES").trim().toUpperCase() || "ES";

  if (nifRaw && !nifRaw.startsWith("PEND-")) {
    const byNif = await tx.client.findFirst({
      where: { nif: { equals: nifRaw, mode: "insensitive" } },
      select: { id: true },
    });
    if (byNif) return { clientId: byNif.id, created: false };
  }

  const clients = await tx.client.findMany({
    select: { id: true, name: true },
  });
  const target = normalizeName(name);
  const exact = clients.find((c) => normalizeName(c.name) === target);
  if (exact) return { clientId: exact.id, created: false };

  const loose = clients.find(
    (c) =>
      normalizeName(c.name).includes(target) ||
      target.includes(normalizeName(c.name))
  );
  if (loose && target.length >= 4) {
    return { clientId: loose.id, created: false };
  }

  const pendingCount = await tx.client.count({
    where: { nif: { startsWith: "PEND-INV" } },
  });
  const nif =
    nifRaw || `PEND-INV${String(pendingCount + 1).padStart(3, "0")}`;

  const created = await tx.client.create({
    data: {
      name,
      nif,
      countryCode,
      addressStreet: input.addressStreet?.trim() || "Sin dirección",
      addressCity: input.addressCity?.trim() || "—",
      addressProvince: input.addressProvince?.trim() || "—",
      addressZip: input.addressZip?.trim() || "00000",
      addressCountry: input.addressCountry?.trim() || "España",
      email: input.email?.trim() || null,
      notes:
        "⚠️ Cliente creado al importar factura histórica (completar datos fiscales si hace falta)",
    },
  });

  return { clientId: created.id, created: true };
}

export async function findDuplicateIssuedInvoice(
  tx: Db,
  opts: { fullNumber: string; seriesId: string; number: number }
): Promise<{ id: string; fullNumber: string } | null> {
  const byFull = await tx.invoice.findFirst({
    where: { fullNumber: { equals: opts.fullNumber, mode: "insensitive" } },
    select: { id: true, fullNumber: true },
  });
  if (byFull) return byFull;

  const bySlot = await tx.invoice.findFirst({
    where: { seriesId: opts.seriesId, number: opts.number },
    select: { id: true, fullNumber: true },
  });
  return bySlot;
}
