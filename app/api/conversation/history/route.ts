import { NextResponse } from "next/server";
import {
  clearConversationHistory,
  getConversationHistory,
} from "@/lib/ai/conversation/history.service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const sessionId = searchParams.get("sessionId");

  if (!userId || !sessionId) {
    return NextResponse.json(
      { error: "userId and sessionId are required." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    history: getConversationHistory(userId, sessionId),
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const sessionId = searchParams.get("sessionId") || undefined;

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required." },
      { status: 400 }
    );
  }

  clearConversationHistory(userId, sessionId);
  return NextResponse.json({ success: true });
}
