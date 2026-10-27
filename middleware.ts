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
  // Aset merek publik (logo, ikon aplikasi, manifest) tidak butuh sesi:
  // tanpa ini, optimizer `/_next/image` gagal memuat sumbernya karena
  // request server-ke-server tidak membawa cookie sesi (redirect ke /login
  // lalu optimizer menerima HTML, bukan gambar). Logika auth di atas tidak
  // berubah — hanya matcher statis yang dilewatkan.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|brand|icons|manifest.webmanifest).*)"],
};
