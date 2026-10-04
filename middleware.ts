import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/public", "/verify", "/demo"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const normalizedPathname = pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "/";

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => normalizedPathname === path || normalizedPathname.startsWith(`${path}/`)
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  const session = request.cookies.get("kodein-klinik-store");

  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", normalizedPathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const sessionData = JSON.parse(session.value);
    if (!sessionData?.state?.currentUserId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", normalizedPathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", normalizedPathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
