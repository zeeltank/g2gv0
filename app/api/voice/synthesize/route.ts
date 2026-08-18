import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/ai/audit/audit-log.service";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().min(1),
  language: z.string().default("en-IN"),
  userId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());

  recordAuditEvent(
    "voice.playback",
    {
      language: body.language,
      textLength: body.text.length,
      mode: "browser",
    },
    { userId: body.userId }
  );

  return NextResponse.json({
    mode: "browser",
    language: body.language,
    text: body.text,
    audioUrl: null,
  });
}
