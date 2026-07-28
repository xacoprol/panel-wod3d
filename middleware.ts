import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Solo comprueba presencia de cookie de sesión (Edge-safe).
 * La validación real JWT/DB sigue en requireAuth del layout Node.
 */
export function middleware(req: NextRequest) {
  const hasSession = Boolean(
    req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value
  );

  if (!hasSession) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/quotes/:path*",
    "/invoices/:path*",
    "/recurring/:path*",
    "/settings/:path*",
  ],
};
