import fs from "fs";
import path from "path";

/** Carga .env con override, sin depender de dotenv (el agente a veces inyecta URLs rotas). */
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    console.error("DATABASE_URL inválida:", process.env.DATABASE_URL?.slice(0, 80));
    process.exit(1);
  }

  console.log("DB:", process.env.DATABASE_URL.slice(0, 48) + "…");
  await import("./seed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
