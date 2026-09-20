import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { readServerConfig } from "./db/config";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicPath = path.startsWith("/login") || path.startsWith("/api/auth");
  const config = readServerConfig(process.env);

  if (!config.configured && !path.startsWith("/configurar")) return NextResponse.redirect(new URL("/configurar", request.url));
  if (config.configured && !publicPath && !getSessionCookie(request)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)"] };
