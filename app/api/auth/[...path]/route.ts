import { NextResponse } from "next/server";
import { readServerConfig } from "../../../../db/config";
import { getAuth } from "../../../../lib/auth/server";

async function handler(request: Request) {
  const config = readServerConfig(process.env);
  if (!config.configured) return NextResponse.json({ error: "Configuração pendente", missing: config.missing }, { status: 503 });
  return getAuth().handler(request);
}

export const GET = handler;
export const POST = handler;
