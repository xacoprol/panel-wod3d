/** Labels for quote vs proforma (same Quote record). */
export function quoteKindLabel(isProforma: boolean): "Proforma" | "Presupuesto" {
  return isProforma ? "Proforma" : "Presupuesto";
}

export function quotePdfTitle(isProforma: boolean): "PROFORMA" | "PRESUPUESTO" {
  return isProforma ? "PROFORMA" : "PRESUPUESTO";
}

export function quotePdfFilename(fullNumber: string, isProforma: boolean): string {
  const prefix = isProforma ? "Proforma" : "Presupuesto";
  return `${prefix}_${fullNumber}.pdf`;
}
