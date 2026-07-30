/**
 * Regenera iconos PWA / favicon con margen seguro.
 * Uso: npx tsx scripts/generate-icons.ts
 *
 * - any / apple: logo en ~70 % del lienzo (evita recortes en esquinas redondeadas)
 * - maskable: logo en ~60 % (zona segura Android)
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public/icons/icon-source.png");
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

async function paddedSquare(
  size: number,
  contentRatio: number
): Promise<Buffer> {
  const content = Math.round(size * contentRatio);
  const logo = await sharp(SOURCE)
    .resize(content, content, {
      fit: "contain",
      background: BG,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function writePng(filePath: string, buf: Buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buf);
  console.log("wrote", path.relative(ROOT, filePath));
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Falta fuente: ${SOURCE}`);
  }

  const anyRatio = 0.58; // ~21 % margen por lado (dock iOS/macOS)
  const maskableRatio = 0.52; // ~24 % (zona segura maskable Android)

  const sizesAny: { file: string; size: number }[] = [
    { file: "public/icons/icon-180.png", size: 180 },
    { file: "public/icons/icon-192.png", size: 192 },
    { file: "public/icons/icon-512.png", size: 512 },
    { file: "public/icons/apple-touch-icon.png", size: 180 },
    { file: "app/icon.png", size: 512 },
    { file: "app/apple-icon.png", size: 180 },
    { file: "public/favicon.png", size: 32 },
  ];

  for (const { file, size } of sizesAny) {
    await writePng(path.join(ROOT, file), await paddedSquare(size, anyRatio));
  }

  await writePng(
    path.join(ROOT, "public/icons/icon-maskable-512.png"),
    await paddedSquare(512, maskableRatio)
  );

  // favicon.ico multi-size (16 + 32)
  const ico16 = await paddedSquare(16, anyRatio);
  const ico32 = await paddedSquare(32, anyRatio);
  // sharp can write .ico on recent versions via toFormat — fallback: copy 32 png rename not ideal
  // Use png-packed ico via sharp if supported
  try {
    const icoBuf = await sharp(ico32).resize(32, 32).toFormat("ico").toBuffer();
    fs.writeFileSync(path.join(ROOT, "public/favicon.ico"), icoBuf);
    fs.writeFileSync(path.join(ROOT, "app/favicon.ico"), icoBuf);
    console.log("wrote public/favicon.ico, app/favicon.ico");
  } catch {
    // Fallback: keep PNG-based approach — write 32px as ico substitute via png
    // Many browsers accept PNG favicon; also write ico32 as .ico raw won't work.
    // Generate simple ICO manually (PNG-in-ICO)
    const ico = await buildPngIco([
      { size: 16, png: ico16 },
      { size: 32, png: ico32 },
    ]);
    fs.writeFileSync(path.join(ROOT, "public/favicon.ico"), ico);
    fs.writeFileSync(path.join(ROOT, "app/favicon.ico"), ico);
    console.log("wrote favicon.ico (PNG-in-ICO)");
  }
}

/** Minimal ICO container with embedded PNG images (Vista+). */
async function buildPngIco(
  entries: { size: number; png: Buffer }[]
): Promise<Buffer> {
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const buffers: Buffer[] = [];
  let offset = headerSize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(count, 4);

  for (let i = 0; i < count; i++) {
    const { size, png } = entries[i];
    const o = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, o);
    header.writeUInt8(size >= 256 ? 0 : size, o + 1);
    header.writeUInt8(0, o + 2); // colors
    header.writeUInt8(0, o + 3);
    header.writeUInt16LE(1, o + 4); // planes
    header.writeUInt16LE(32, o + 6); // bit count
    header.writeUInt32LE(png.length, o + 8);
    header.writeUInt32LE(offset, o + 12);
    offset += png.length;
    buffers.push(png);
  }

  return Buffer.concat([header, ...buffers]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
