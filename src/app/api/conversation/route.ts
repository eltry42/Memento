import { NextRequest, NextResponse } from "next/server";
import { listConversation } from "@/lib/mvp-db";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? undefined;
  const messages = listConversation(sessionId);

  return NextResponse.json({ messages });
}
