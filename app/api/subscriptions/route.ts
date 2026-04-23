import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmationEmail, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  make: z.string().optional(),
  model: z.string().optional(),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  mileageMax: z.coerce.number().int().optional(),
  city: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  trim: z.string().optional(),
  bodyStyle: z.string().optional(),
  driveType: z.string().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  color: z.string().optional(),
  titleStatus: z.string().optional(),
  maxOwners: z.number().int().optional(),
  noAccidents: z.boolean().optional(),
  requiredFeatures: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { prisma } = await import("@/lib/db");
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      email,
      make,
      model,
      yearMin,
      yearMax,
      priceMin,
      priceMax,
      mileageMax,
      city,
      keywords,
      trim,
      bodyStyle,
      driveType,
      transmission,
      fuelType,
      color,
      titleStatus,
      maxOwners,
      noAccidents,
      requiredFeatures,
    } = parsed.data;

    const priceMinCents =
      priceMin != null ? Math.round(priceMin * 100) : null;
    const priceMaxCents =
      priceMax != null ? Math.round(priceMax * 100) : null;

    const sub = await prisma.subscription.create({
      data: {
        email,
        make: make || null,
        model: model || null,
        yearMin: yearMin || null,
        yearMax: yearMax || null,
        priceMin: priceMinCents,
        priceMax: priceMaxCents,
        mileageMax: mileageMax || null,
        city: city || null,
        keywords: keywords || [],
        trim: trim || null,
        bodyStyle: bodyStyle || null,
        driveType: driveType || null,
        transmission: transmission || null,
        fuelType: fuelType || null,
        color: color || null,
        titleStatus: titleStatus || null,
        maxOwners: maxOwners || null,
        noAccidents: noAccidents || false,
        requiredFeatures: requiredFeatures || [],
      },
    });

    // Fire-and-forget email to avoid hanging the UI if SMTP is slow
    const { subject, html } = confirmationEmail({
      email,
      filters: {
        make: make ?? undefined,
        model: model ?? undefined,
        yearMin: yearMin ?? undefined,
        yearMax: yearMax ?? undefined,
        priceMin: priceMinCents ?? undefined,
        priceMax: priceMaxCents ?? undefined,
        mileageMax: mileageMax ?? undefined,
        city: city ?? undefined,
      },
    });

    sendMail({ to: email, subject, html }).catch((err) => {
      console.error("[api/subscriptions] Background email failed:", err);
    });

    return NextResponse.json({ success: true, id: sub.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save subscription";
    console.error("[api/subscriptions]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
