/**
 * Validación laxa de identificadores fiscales por país.
 * - ES: NIF/CIF/NIE español estricto
 * - PT: NIF portugués (9 dígitos)
 * - resto: texto libre (mín. 3 caracteres alfanuméricos)
 */

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizeTaxId(value: string): string {
  return value.replace(/[\s.-]/g, "").toUpperCase();
}

function isValidNifNumber(digits: string, letter: string): boolean {
  const num = parseInt(digits, 10);
  if (Number.isNaN(num)) return false;
  return NIF_LETTERS[num % 23] === letter;
}

export function isValidSpanishTaxId(value: string): boolean {
  const v = normalizeTaxId(value);
  if (!v || v.length !== 9) return false;

  if (/^\d{8}[A-Z]$/.test(v)) {
    return isValidNifNumber(v.slice(0, 8), v[8]);
  }

  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const prefix = { X: "0", Y: "1", Z: "2" }[v[0] as "X" | "Y" | "Z"];
    return isValidNifNumber(prefix + v.slice(1, 8), v[8]);
  }

  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    return isValidCif(v);
  }

  return false;
}

function isValidCif(cif: string): boolean {
  const digits = cif.slice(1, 8);
  const control = cif[8];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      const d = n * 2;
      sum += Math.floor(d / 10) + (d % 10);
    } else {
      sum += n;
    }
  }
  const unit = (10 - (sum % 10)) % 10;
  const letterControl = "JABCDEFGHI"[unit];
  const letter = cif[0];

  if ("PQRSNW".includes(letter)) return control === letterControl;
  if ("ABEH".includes(letter)) return control === String(unit);
  return control === String(unit) || control === letterControl;
}

/** NIF portugués: 9 dígitos */
export function isValidPortugueseTaxId(value: string): boolean {
  const v = normalizeTaxId(value);
  return /^\d{9}$/.test(v);
}

/**
 * Validación laxa por país. countryCode ISO-2 (ES, PT, …).
 * Para países desconocidos: mínimo 3 caracteres alfanuméricos.
 */
export function isValidTaxId(
  value: string,
  countryCode = "ES"
): boolean {
  const code = countryCode.toUpperCase();
  const v = normalizeTaxId(value);
  if (!v) return false;

  if (code === "ES") return isValidSpanishTaxId(v);
  if (code === "PT") return isValidPortugueseTaxId(v);

  // Lax: any alphanumeric tax id >= 3 chars
  return /^[A-Z0-9]{3,20}$/.test(v);
}

export function taxIdErrorMessage(
  value: string,
  countryCode = "ES"
): string | null {
  if (!value?.trim()) return "El NIF/CIF/VAT es obligatorio";
  if (isValidTaxId(value, countryCode)) return null;

  const code = countryCode.toUpperCase();
  if (code === "ES") {
    return "NIF/CIF no válido (formato español: 12345678A o A12345678)";
  }
  if (code === "PT") {
    return "NIF portugués no válido (9 dígitos)";
  }
  return "Identificador fiscal no válido (mín. 3 caracteres)";
}

export const COUNTRY_OPTIONS = [
  { code: "ES", name: "España" },
  { code: "PT", name: "Portugal" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "OTHER", name: "Otro" },
] as const;

export function countryNameFromCode(code: string): string {
  return (
    COUNTRY_OPTIONS.find((c) => c.code === code.toUpperCase())?.name ?? code
  );
}
