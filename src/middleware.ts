import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/", "/sign-in", "/sign-up", "/api/auth", "/api/trpc"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie (Better Auth uses __session or better-auth.session_token)
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__session");

  if (!sessionCookie) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
