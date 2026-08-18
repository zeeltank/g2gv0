import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    speechToText: {
      mode: "browser",
      supported: true,
    },
    textToSpeech: {
      mode: "browser",
      supported: true,
    },
    languages: [
      { label: "English", value: "en-IN" },
      { label: "Hindi", value: "hi-IN" },
      { label: "Gujarati", value: "gu-IN" },
    ],
  });
}
