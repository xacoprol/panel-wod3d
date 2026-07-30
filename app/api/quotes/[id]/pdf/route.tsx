import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildQuotePdf } from "@/lib/pdf/build-document-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  try {
    const pdf = await buildQuotePdf(id);
    const asDownload = _req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(pdf.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${pdf.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
