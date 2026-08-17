import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/ai/audit/audit-log.service";

export const runtime = "nodejs";

const requestSchema = z.object({
  transcript: z.string().optional(),
  language: z.string().default("en-IN"),
  userId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());

  if (!body.transcript?.trim()) {
    return NextResponse.json(
      {
        error:
          "Server-side transcription is not configured. Use browser speech recognition or provide a transcript.",
      },
      { status: 501 }
    );
  }

  recordAuditEvent(
    "voice.transcript",
    {
      language: body.language,
      transcriptLength: body.transcript.length,
    },
    { userId: body.userId }
  );

  return NextResponse.json({
    transcript: body.transcript.trim(),
    language: body.language,
    source: "client-provided",
  });
}
