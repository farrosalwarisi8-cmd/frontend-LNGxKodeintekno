import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isPublicPath, normalizePath } from "./lib/public-paths";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const normalizedPathname = normalizePath(pathname);

  if (isPublicPath(normalizedPathname)) {
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
