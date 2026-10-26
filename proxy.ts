import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { readServerConfig } from "./db/config";

const LEGACY_VERCEL_HOST = "oficina-saas-green.vercel.app";
const CANONICAL_APP_ORIGIN = "https://oficina-saas.contato-ad4.workers.dev";

export function getCanonicalRedirectUrl(url: URL) {
  if (url.hostname !== LEGACY_VERCEL_HOST) return null;

  return new URL(`${url.pathname}${url.search}${url.hash}`, CANONICAL_APP_ORIGIN);
}

export function isPublicRoute(path: string) {
  return (
    path.startsWith("/login") ||
    path.startsWith("/primeiro-acesso") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/api/webhooks/") ||
    path.startsWith("/orcamento/") ||
    path.startsWith("/mecanico/") ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js"
  );
}

export function proxy(request: NextRequest) {
  const canonicalUrl = getCanonicalRedirectUrl(request.nextUrl);
  if (canonicalUrl) return NextResponse.redirect(canonicalUrl, 308);

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
