import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") ?? "http://localhost:8080";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const parsed = new URL(url);
  const allowedOrigin = new URL(API_BASE).origin;
  if (parsed.origin !== allowedOrigin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const contentType = res.headers.get("content-type") ?? "image/png";
    const blob = await res.arrayBuffer();
    return new NextResponse(blob, {
      headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=60" },
    });
  } catch (e) {
    return new NextResponse(null, { status: 502 });
  }
}
