import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ error: "Missing subscription ID" }, { status: 400 });
    }

    await prisma.subscription.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Subscription terminated" });
  } catch (error) {
    console.error("[api/subscriptions/[id]/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { prisma } = await import("@/lib/prisma");
    const { id } = params;
    const { email } = await req.json();

    if (!id || !email) {
      return NextResponse.json({ error: "Missing ID or email" }, { status: 400 });
    }

    const updated = await prisma.subscription.update({
      where: { id },
      data: { email },
    });

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error) {
    console.error("[api/subscriptions/[id]/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}
