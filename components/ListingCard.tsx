"use client";

import * as React from "react";
import { useState, memo } from "react";
import Image from "next/image";
import { Gauge, MapPin, ArrowRightLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListingDetailModal } from "./ListingDetailModal";
import { useComparison } from "@/context/ComparisonContext";

function formatUsd(cents: number): string {
  if (cents === 0) return "Contact seller";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const placeholderSvg =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#111113"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#333" font-family="system-ui" font-weight="700" font-size="14" letter-spacing="0.1em">No image</text>
    </svg>`,
  );

export const ListingCard = memo(function ListingCard({ listing }: { listing: any }): React.ReactElement {
  const [imgOk, setImgOk] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const src = (listing.imageUrls && listing.imageUrls.length > 0) && imgOk ? listing.imageUrls[0] : placeholderSvg;

  const hasMake = listing.make && listing.make !== "Unknown";
  const hasModel = listing.model && listing.model !== "Unknown";

  let displayTitle = listing.rawTitle?.trim() || "Vehicle";
  if (hasMake || listing.year > 0) {
    const year = listing.year > 0 ? `${listing.year} ` : "";
    const make = hasMake ? listing.make : "";
    const model = hasModel ? ` ${listing.model}` : "";
    displayTitle = `${year}${make}${model}`.trim();
  }

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null
    ? `${(listing.mileage / 1000).toFixed(0)}k mi`
    : null;

  const dealRating = listing.analysis?.rating;

  return (
    <ListingDetailModal listing={listing}>
      <article className="group relative flex flex-col overflow-hidden rounded-xl bg-surface border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover hover:border-primary/20 cursor-pointer active:scale-[0.99] h-full">

        {/* Image */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-raised shrink-0">
          {/* Skeleton shimmer until loaded */}
          {!imgLoaded && (
            <div className="absolute inset-0 skeleton" />
          )}
          <Image
            src={src}
            alt={displayTitle}
            fill
            className={cn(
              "object-cover transition-all duration-500 group-hover:scale-[1.04]",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgOk(false); setImgLoaded(true); }}
             sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />

          {/* Sold overlay */}
          {listing.isSold && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[4px] transition-all duration-300">
              <span className="px-5 py-2 rounded-xl bg-red-600 text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-2xl border border-white/20 scale-110">
                Vehicle Sold
              </span>
            </div>
          )}

          {/* Deal badge */}
          {dealRating && dealRating !== "unknown" && !listing.isSold && (
            <div className="absolute top-3 left-3 z-10">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold",
                dealRating === "great"
                  ? "bg-emerald-500/90 text-white"
                  : "bg-surface/90 border border-border text-muted-foreground"
              )}>
                {dealRating === "great" ? "🔥 Great deal" : "✓ Good"}
              </span>
            </div>
          )}

          {/* Price badge */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className="inline-block bg-background/90 backdrop-blur-sm border border-border px-3 py-1 rounded-lg text-sm font-bold text-foreground">
              {formatUsd(listing.price)}
            </span>
          </div>

          {/* Comparison toggle on hover (desktop) */}
          <div className="absolute bottom-3 right-3 z-10 hidden sm:block opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
            <ComparisonToggle listing={listing} />
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4">
          {/* Title */}
          <h2 className="text-sm sm:text-base font-semibold text-foreground leading-tight mb-2 line-clamp-1 group-hover:text-primary transition-colors">
            {displayTitle}
          </h2>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {listing.transmission && (
              <Tag>{listing.transmission}</Tag>
            )}
            {listing.bodyStyle && (
              <Tag>{listing.bodyStyle}</Tag>
            )}
            {listing.trim && (
              <Tag highlight>{listing.trim}</Tag>
            )}
          </div>

          {/* Footer: mileage + location */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {mileage && (
                <span className="flex items-center gap-1">
                  <Gauge size={12} />
                  {mileage}
                </span>
              )}
              {loc && (
                <span className="flex items-center gap-1 truncate max-w-[120px]">
                  <MapPin size={12} className="shrink-0" />
                  {loc}
                </span>
              )}
            </div>
            {/* Mobile comparison */}
            <div className="sm:hidden">
              <ComparisonToggle listing={listing} compact />
            </div>
          </div>
        </div>
      </article>
    </ListingDetailModal>
  );
});

function Tag({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span className={cn(
      "inline-block px-2 py-0.5 rounded-full text-[10px] font-medium",
      highlight
        ? "bg-primary/10 text-primary"
        : "bg-surface-raised text-muted-foreground"
    )}>
      {children}
    </span>
  );
}

function ComparisonToggle({ listing, compact }: { listing: any; compact?: boolean }) {
  const { addToComparison, removeFromComparison, isInComparison, comparisonList } = useComparison();
  const active = isInComparison(listing.id);
  const isFull = comparisonList.length >= 4 && !active;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) removeFromComparison(listing.id);
    else if (!isFull) addToComparison(listing);
  };

  return (
    <button
      onClick={toggle}
      disabled={isFull}
      title={active ? "Remove from comparison" : "Add to comparison"}
      className={cn(
        "flex items-center justify-center rounded-full border transition-all duration-200",
        compact ? "h-7 w-7" : "h-8 w-8",
        active
          ? "bg-primary border-primary text-white shadow-blue"
          : "bg-background/80 backdrop-blur-sm border-border text-muted-foreground hover:border-primary hover:text-primary",
        isFull && "opacity-40 cursor-not-allowed"
      )}
    >
      {active ? <Check size={compact ? 12 : 14} /> : <ArrowRightLeft size={compact ? 12 : 14} />}
    </button>
  );
}
