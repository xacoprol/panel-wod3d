/**
 * One-off import: listado_clientes_28072026.xls → Client table
 * Usage: npx tsx scripts/import-clients.ts [path-to-xls]
 */
import path from "path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const PROVINCES = [
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Barcelona",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Girona",
  "Granada",
  "Guadalajara",
  "Guipúzcoa",
  "Huelva",
  "Huesca",
  "Islas Baleares",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Murcia",
  "Navarra",
  "Ourense",
  "Orense",
  "Palencia",
  "Pontevedra",
  "PONTEVEDRA",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Vizcaya",
  "Zamora",
  "Zaragoza",
];

function cleanPhone(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  let s = String(raw)
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!s) return null;
  return s;
}

function cleanText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function parseAddress(raw: string): {
  street: string;
  city: string;
  province: string;
  zip: string;
  country: string;
} {
  const text = cleanText(raw).replace(/\r/g, "");
  if (!text || text === "España" || text === "Portugal") {
    return {
      street: "",
      city: "",
      province: "",
      zip: "",
      country: text === "Portugal" ? "Portugal" : "España",
    };
  }

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let country = "España";
  let body = text.replace(/\n/g, " ").trim();

  const last = lines[lines.length - 1]?.toLowerCase();
  if (last === "españa" || last === "portugal") {
    country = last === "portugal" ? "Portugal" : "España";
    body = lines.slice(0, -1).join(" ").trim() || body;
  }

  // Portuguese CP: 8000-349
  const ptZip = body.match(/\b(\d{4}-\d{3})\b/);
  // Spanish CP: 5 digits
  const esZip = body.match(/\b(\d{5})\b/);
  const zip = ptZip?.[1] ?? esZip?.[1] ?? "";

  let province = "";
  for (const p of PROVINCES) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(body)) {
      province = p === "PONTEVEDRA" ? "Pontevedra" : p === "Orense" ? "Ourense" : p;
      break;
    }
  }

  let city = "";
  let street = body;

  if (zip) {
    const idx = body.indexOf(zip);
    const before = body.slice(0, idx).trim().replace(/[,\s]+$/, "");
    let after = body.slice(idx + zip.length).trim();
    // Remove duplicated zip if present
    after = after.replace(new RegExp(`^${zip}\\s*`), "").trim();
    street = before || body;
    // City is usually first token(s) before province in "after"
    if (province && after.toUpperCase().includes(province.toUpperCase())) {
      const pi = after.toUpperCase().lastIndexOf(province.toUpperCase());
      city = after.slice(0, pi).trim().replace(/[,\s]+$/, "");
      // If province appears twice at end, ok
    } else if (after) {
      // Take first word group as city
      const parts = after.split(/\s+/);
      if (parts.length >= 1) {
        // Heuristic: city is uppercase-ish block before province name
        city = after;
        if (province) {
          city = after.replace(new RegExp(province, "i"), "").trim();
        }
      }
    }
  } else if (province) {
    const pi = body.toUpperCase().lastIndexOf(province.toUpperCase());
    if (pi > 0) {
      street = body.slice(0, pi).trim();
      // maybe city is last word of street
    } else {
      city = body;
      street = "";
    }
  } else {
    // Only province/city name
    if (!body.includes(",") && body.split(" ").length <= 4) {
      city = body;
      street = "";
    } else {
      street = body;
    }
  }

  city = city.replace(/\s+/g, " ").trim();
  street = street.replace(/\s+/g, " ").trim();

  // If city empty but street has trailing ALLCAPS city-like token, leave as-is
  if (!city && !street && body) street = body;

  return {
    street: street || (city ? "" : body) || "Sin dirección",
    city: city || "—",
    province: province || "—",
    zip: zip || "00000",
    country,
  };
}

async function main() {
  const file =
    process.argv[2] ||
    path.join(
      process.env.HOME || "",
      "Downloads/listado_clientes_28072026.xls"
    );

  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  });

  // Find header row with CLIENTE
  let start = rows.findIndex(
    (r) => String(r[0]).trim().toUpperCase() === "CLIENTE"
  );
  if (start < 0) start = 2;
  else start += 1;

  const clients = rows
    .slice(start)
    .map((r) => ({
      name: cleanText(r[0]),
      nif: cleanText(r[1]).toUpperCase().replace(/[\s.-]/g, ""),
      addressRaw: cleanText(r[2]),
      contactPerson: cleanText(r[5]) || null,
      phone: cleanPhone(r[6]),
      email: cleanText(r[7]).toLowerCase() || null,
      payment: cleanText(r[8]),
      observations: cleanText(r[9]),
    }))
    .filter((c) => c.name && c.name.toUpperCase() !== "CLIENTE");

  console.log(`Filas a importar: ${clients.length}`);

  let created = 0;
  let skipped = 0;
  const issues: string[] = [];

  for (const c of clients) {
    const existing = await prisma.client.findFirst({
      where: {
        OR: [
          ...(c.nif
            ? [{ nif: c.nif }]
            : []),
          { name: c.name },
        ],
      },
    });
    if (existing) {
      console.log(`  skip (ya existe): ${c.name}`);
      skipped++;
      continue;
    }

    const addr = parseAddress(c.addressRaw);
    const noteParts: string[] = [];
    if (c.payment) noteParts.push(`Forma de cobro: ${c.payment}`);
    if (c.observations) noteParts.push(c.observations);
    if (!c.nif) {
      noteParts.push("⚠️ NIF/CIF pendiente de completar (importación)");
      issues.push(`${c.name}: sin NIF`);
    }
    if (c.nif && !/^[A-Z0-9]{9}$/.test(c.nif) && !/^\d{8}[A-Z]$/.test(c.nif)) {
      // Portuguese or atypical — keep as-is but flag
      if (c.nif.length !== 9) {
        noteParts.push(`NIF/CIF original (no ES estándar): ${c.nif}`);
        issues.push(`${c.name}: NIF atípico ${c.nif}`);
      }
    }

    // Placeholder NIF so the field is never empty (required in UI later)
    const nif = c.nif || `PENDIENTE`;

    // If multiple PENDIENTE, make unique to avoid confusion in lists
    let finalNif = nif;
    if (nif === "PENDIENTE") {
      finalNif = `PEND-${String(created + skipped + 1).padStart(4, "0")}`;
    }

    await prisma.client.create({
      data: {
        name: c.name,
        nif: finalNif,
        addressStreet: addr.street || "Sin dirección",
        addressCity: addr.city,
        addressProvince: addr.province,
        addressZip: addr.zip,
        addressCountry: addr.country,
        email: c.email,
        phone: c.phone,
        contactPerson: c.contactPerson,
        notes: noteParts.length ? noteParts.join("\n") : null,
      },
    });
    created++;
    console.log(`  + ${c.name} (${finalNif})`);
  }

  console.log(`\nImportados: ${created} | Omitidos: ${skipped}`);
  if (issues.length) {
    console.log(`\nAvisos (${issues.length}):`);
    issues.forEach((i) => console.log(`  - ${i}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
