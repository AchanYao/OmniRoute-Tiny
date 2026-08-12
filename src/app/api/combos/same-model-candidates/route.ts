import { NextResponse } from "next/server";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { resolveSameModelComboCandidates } from "@/sse/services/sameModelAggregation";

export async function GET(request: Request) {
  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const candidates = await resolveSameModelComboCandidates();
    return NextResponse.json({ candidates });
  } catch (error) {
    console.log("Error resolving same-model Combo candidates:", error);
    return NextResponse.json(
      { error: "Failed to resolve same-model Combo candidates" },
      { status: 500 }
    );
  }
}
