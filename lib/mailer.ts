import nodemailer from "nodemailer";

export type AlertFilters = {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  city?: string;
};

export type MailListing = {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number | null;
  city: string | null;
  state: string | null;
  imageUrls: string[];
  listingUrl: string;
  trim?: string;
  transmission?: string;
  condition?: string;
};

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function filterSummaryHtml(filters: AlertFilters): string {
  const parts: string[] = [];
  if (filters.make) parts.push(`Make: ${filters.make}`);
  if (filters.model) parts.push(`Model: ${filters.model}`);
  if (filters.yearMin != null || filters.yearMax != null) {
    parts.push(
      `Year: ${filters.yearMin ?? "any"} – ${filters.yearMax ?? "any"}`,
    );
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    parts.push(
      `Price: ${filters.priceMin != null ? formatUsdFromCents(filters.priceMin) : "any"} – ${filters.priceMax != null ? formatUsdFromCents(filters.priceMax) : "any"}`,
    );
  }
  if (filters.mileageMax != null) {
    parts.push(`Max mileage: ${filters.mileageMax.toLocaleString()} mi`);
  }
  if (filters.city) parts.push(`City: ${filters.city}`);
  return parts.length > 0 ? parts.join("<br/>") : "Any vehicle";
}

function filterSummaryPlain(filters: AlertFilters): string {
  const parts: string[] = [];
  if (filters.make) parts.push(filters.make);
  if (filters.model) parts.push(filters.model);
  if (filters.yearMin != null || filters.yearMax != null) {
    parts.push(`${filters.yearMin ?? "…"}–${filters.yearMax ?? "…"}`);
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    const a =
      filters.priceMin != null ? formatUsdFromCents(filters.priceMin) : "…";
    const b =
      filters.priceMax != null ? formatUsdFromCents(filters.priceMax) : "…";
    parts.push(`${a} – ${b}`);
  }
  if (filters.mileageMax != null) {
    parts.push(`Under ${filters.mileageMax.toLocaleString()} mi`);
  }
  if (filters.city) parts.push(filters.city);
  return parts.join(" · ") || "Any criteria";
}

function createTransport() {
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT ?? "587");
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD?.replace(/\s+/g, "");
  if (!host || !user || !pass) {
    throw new Error("Email configuration is incomplete (EMAIL_* env vars).");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function confirmationEmail(input: {
  email: string;
  filters: AlertFilters;
}): { subject: string; html: string } {
  const { email, filters } = input;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const criteria = filterSummaryHtml(filters);
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;font-family:Inter,Segoe UI,system-ui,sans-serif;background:#f1f5f9;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
              AutoPulse
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Your alert is active!</h1>
              <p style="margin:0 0 16px;line-height:1.6;">We saved an alert for <strong>${escapeHtml(email)}</strong>.</p>
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px;">
                <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Saved criteria</div>
                <div style="font-size:15px;line-height:1.6;color:#1e293b;">${criteria}</div>
              </div>
              <p style="margin:0 0 24px;line-height:1.6;">
                We'll email you as soon as we find a matching listing on Facebook Marketplace.
              </p>
              <a href="${escapeHtml(appUrl)}/search" style="display:inline-block;background:#1877f2;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
                Browse Listings Now
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#64748b;line-height:1.5;border-top:1px solid #e2e8f0;">
              AutoPulse is an independent search tool and is not affiliated with, endorsed by, or connected to Meta or Facebook in any way.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject: "✅ AutoPulse Alert Saved", html };
}

export function newListingsEmail(input: {
  email: string;
  listings: MailListing[];
  filters: AlertFilters;
  totalMatching?: number;
}): { subject: string; html: string } {
  const { email, listings, filters, totalMatching } = input;
  const n = listings.length;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const summary = filterSummaryPlain(filters);
  const more =
    totalMatching != null && totalMatching > n
      ? totalMatching - n
      : 0;

  const rows = listings
    .map((l) => {
      const img = (l.imageUrls && l.imageUrls.length > 0)
        ? `<img src="${escapeHtml(l.imageUrls[0])}" width="60" height="60" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;"/>`
        : `<div style="width:60px;height:60px;background:#e2e8f0;border-radius:8px;"></div>`;
      const loc = [l.city, l.state].filter(Boolean).join(", ") || "—";
      const mileage =
        l.mileage != null ? `${l.mileage.toLocaleString()} mi` : "—";
      return `<tr>
        <td style="padding:12px 8px;vertical-align:middle;">${img}</td>
        <td style="padding:12px 8px;vertical-align:middle;font-weight:600;">${escapeHtml(String(l.year))} ${escapeHtml(l.make)} ${escapeHtml(l.model)}</td>
        <td style="padding:12px 8px;vertical-align:middle;color:#1877f2;font-weight:700;">${formatUsdFromCents(l.price)}</td>
        <td style="padding:12px 8px;vertical-align:middle;font-size:14px;">${escapeHtml(mileage)}</td>
        <td style="padding:12px 8px;vertical-align:middle;font-size:14px;">${escapeHtml(loc)}</td>
        <td style="padding:12px 8px;vertical-align:middle;">
          <a href="${escapeHtml(l.listingUrl)}" style="display:inline-block;border:1px solid #1877f2;color:#1877f2;padding:8px 12px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View on Facebook →</a>
        </td>
      </tr>`;
    })
    .join("");

  const moreBlock =
    more > 0
      ? `<p style="margin:16px 0 0;font-size:14px;"><a href="${escapeHtml(appUrl)}/search" style="color:#1877f2;">…and ${more} more. View all on AutoPulse.</a></p>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;font-family:Inter,Segoe UI,system-ui,sans-serif;background:#f1f5f9;color:#1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#0f172a;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:700;">
              AutoPulse
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">We found ${n} new match${n === 1 ? "" : "es"}!</h1>
              <p style="margin:0 0 20px;color:#64748b;font-size:15px;">${escapeHtml(summary)}</p>
              <p style="margin:0 0 12px;font-size:14px;">Hi ${escapeHtml(email)}, here are listings that match your alert:</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;">
                <thead>
                  <tr style="background:#f8fafc;font-size:12px;color:#64748b;text-align:left;">
                    <th style="padding:8px;"></th>
                    <th style="padding:8px;">Vehicle</th>
                    <th style="padding:8px;">Price</th>
                    <th style="padding:8px;">Mileage</th>
                    <th style="padding:8px;">Location</th>
                    <th style="padding:8px;"></th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
              ${moreBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#64748b;line-height:1.5;border-top:1px solid #e2e8f0;">
              To stop receiving these emails, reply with "unsubscribe" (MVP — manual processing).<br/><br/>
              AutoPulse is an independent search tool and is not affiliated with, endorsed by, or connected to Meta or Facebook in any way.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `🚗 ${n} new listings match your AutoPulse alert`,
    html,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromEmail) {
    throw new Error("No sender email found (EMAIL_FROM or EMAIL_USER).");
  }
  const transport = createTransport();
  await transport.sendMail({
    from: `AutoPulse <${fromEmail}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
