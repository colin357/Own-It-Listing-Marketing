import { NextResponse, type NextRequest } from "next/server";

/**
 * HTTP Basic auth in front of /admin. Username can be anything (or ADMIN_USER
 * if set); the password is ADMIN_PASSWORD. The public kit pages (/l/...) and
 * the bearer-token API (/api/...) are not affected.
 */
export function proxy(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("Admin is disabled: set the ADMIN_PASSWORD environment variable.", { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const sep = decoded.indexOf(":");
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    const userOk = !process.env.ADMIN_USER || user === process.env.ADMIN_USER;
    if (sep >= 0 && userOk && pass === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Listing Marketing Admin"' },
  });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
