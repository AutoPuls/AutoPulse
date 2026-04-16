import { NextResponse } from "next/server";
import { getReparseQueue } from "@/lib/queue";

export async function POST() {
  try {
    const reparseQueue = getReparseQueue();
    await reparseQueue.add("reparseAll", {}, { 
      removeOnComplete: true,
      jobId: "globalReparse" // Ensure only one runs at a time
    });
    
    return NextResponse.json({ message: "Reparse job queued" });
  } catch (e) {
    console.error("[api/admin/reparse]", e);
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }
}
