import { NextResponse } from "next/server";

const VERSION = "0.1.7";

export async function GET() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const response = NextResponse.json({
    status: "ok",
    version: VERSION,
    mode: isDemoMode ? "demo" : "live",
    timestamp: new Date().toISOString(),
  });

  // Add CORS headers for cross-origin requests
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
