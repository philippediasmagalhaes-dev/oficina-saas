import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { readServerConfig } from "./db/config";

export function isPublicRoute(path: string) {
  return (
    path.startsWith("/login") ||
    path.startsWith("/primeiro-acesso") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/orcamento/") ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js"
  );
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath = isPublicRoute(path);
  const config = readServerConfig(process.env);

  if (!config.configured && !path.startsWith("/configurar"))
    return NextResponse.redirect(new URL("/configurar", request.url));
  if (config.configured && !publicPath && !getSessionCookie(request))
    return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.jpg|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
