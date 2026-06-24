import { NextRequest, NextResponse } from "next/server";
import { EMPTY_ONBOARDING, type OnboardingSummary } from "@/lib/onboarding";

declare global {
  var gtgOnboardingStore: Map<string, OnboardingSummary> | undefined;
}

const store = globalThis.gtgOnboardingStore ?? new Map<string, OnboardingSummary>();
globalThis.gtgOnboardingStore = store;

function userId(request: NextRequest) {
  return request.nextUrl.searchParams.get("userId")?.trim();
}

export async function GET(request: NextRequest) {
  const id = userId(request);
  if (!id) return NextResponse.json({ message: "userId is required" }, { status: 400 });
  return NextResponse.json(store.get(id) ?? EMPTY_ONBOARDING);
}

export async function PATCH(request: NextRequest) {
  const id = userId(request);
  if (!id) return NextResponse.json({ message: "userId is required" }, { status: 400 });
  const update = await request.json() as Partial<OnboardingSummary>;
  const current = store.get(id) ?? EMPTY_ONBOARDING;
  const next = { ...current, ...update, updatedAt: new Date().toISOString() };
  store.set(id, next);
  return NextResponse.json(next);
}
