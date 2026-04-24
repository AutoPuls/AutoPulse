"use client";

import * as React from "react";
import { useState, memo } from "react";
import Image from "next/image";
import { Gauge, MapPin, Sparkles, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Listing } from "@prisma/client";
import { ListingDetailModal } from "./ListingDetailModal";
import { useComparison } from "@/context/ComparisonContext";
import { ArrowRightLeft, Check } from "lucide-react";

function formatUsd(cents: number): string {
  if (cents === 0) return "FREE";
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
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0A0C0F;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#16191D;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#g)"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" opacity="0.3" font-family="system-ui" font-weight="900" font-size="40" letter-spacing="0.2em">AUTOPULSE</text>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#888" opacity="0.5" font-family="system-ui" font-weight="500" font-size="14" letter-spacing="0.1em">VISUAL CAPTURE PENDING</text>
    </svg>`,
  );

export const ListingCard = memo(function ListingCard({ listing }: { listing: any }): React.ReactElement {
  const [imgOk, setImgOk] = useState(true);
  const src = (listing.imageUrls && listing.imageUrls.length > 0) && imgOk ? listing.imageUrls[0] : placeholderSvg;

  const hasParsedMake = listing.make !== "Unknown";
  const hasParsedModel = listing.model !== "Unknown";

  const isGenericTitle = (listing.rawTitle || "").toLowerCase().includes("marketplace listing") || (listing.rawTitle || "").length < 2;
  
  let title = (listing.rawTitle?.trim() || "Automotive Entry");
  
  if (hasParsedMake || listing.year > 0) {
    const yearPrefix = listing.year > 0 ? `${listing.year} ` : "";
    const makePart = hasParsedMake ? listing.make : "Vehicle";
    const modelSuffix = hasParsedModel ? ` ${listing.model}` : "";
    title = `${yearPrefix}${makePart}${modelSuffix}`;
  } else if (isGenericTitle) {
    title = "Vehicle Record Scan";
  }

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null
    ? `${(listing.mileage / 1000).toFixed(1)}k mi`
    : "N/A";

  return (
    <ListingDetailModal listing={listing}>
      <article className="group relative flex flex-col overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-card/40 backdrop-blur-3xl ring-1 ring-white/5 transition-all duration-700 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)] hover:-translate-y-2 hover:ring-white/20 cursor-pointer active:scale-[0.98] border border-white/5 h-full">
        
        {/* Visual Engine */}
        <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full overflow-hidden shrink-0">
          <Image
            src={src}
            alt={title}
            fill
            className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.1]"
            onError={() => setImgOk(false)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-black/10 opacity-100" />
          
          {/* Price Badge */}
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6 z-30">
             <div className="rounded-xl sm:rounded-2xl bg-white px-3 py-1.5 sm:px-4 sm:py-2 shadow-2xl transition-all duration-500 group-hover:scale-105">
                <p className="text-lg sm:text-xl font-black tracking-tighter text-black leading-none uppercase">
                   {formatUsd(listing.price)}
                </p>
             </div>
          </div>

          {/* Deal Rating */}
          {listing.analysis && listing.analysis.rating !== 'unknown' && (
            <div className="absolute left-4 top-4 sm:left-6 sm:top-6 z-20">
              <div className={cn(
                "flex h-7 sm:h-8 items-center justify-center rounded-lg sm:rounded-xl px-2.5 sm:px-4 text-[8px] sm:text-[9px] font-black tracking-[0.2em] backdrop-blur-xl border uppercase transition-all duration-500",
                listing.analysis.rating === 'great' ? "bg-white text-black border-white" :
                listing.analysis.rating === 'good' ? "bg-white/10 text-white border-white/20" :
                "bg-white/5 text-white/40 border-white/5"
              )}>
                {listing.analysis.rating === 'great' ? "🔥 PRIORITY" : 
                 listing.analysis.rating === 'good' ? "✨ TARGET" : "UNIT"}
              </div>
            </div>
          )}
          
          {/* Spec Bar */}
          <div className="absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-6 z-20 flex gap-2">
            <div className="flex flex-1 items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-black/70 backdrop-blur-2xl border border-white/10 px-3 py-2 sm:px-4 sm:py-2.5 transition-all duration-500 overflow-hidden">
               <div className="flex items-center gap-1.5 border-r border-white/10 pr-2 sm:pr-3 shrink-0">
                  <Gauge size={10} className="text-white/40 sm:size-3" />
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-white/90 uppercase">{mileage}</span>
               </div>
               <div className="flex items-center gap-1.5 truncate">
                  <MapPin size={10} className="text-white/40 sm:size-3" />
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-white/90 truncate uppercase">{listing.city || "USA"}</span>
               </div>
            </div>
            
            <div className="hidden sm:flex shrink-0 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
               <ComparisonToggle listing={listing} />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="relative z-10 flex flex-1 flex-col px-5 pb-6 pt-5 sm:px-8 sm:pb-8 sm:pt-6">
          <div className="mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
               <span className="text-[8px] sm:text-[9px] font-black tracking-[0.3em] text-white/40 uppercase">
                 {listing.year || "NODE"}
               </span>
               <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
            <h2 className="line-clamp-1 font-display text-lg sm:text-2xl font-black leading-tight tracking-tight text-foreground transition-colors duration-500 uppercase italic">
              {title}
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4 sm:mb-5">
            {listing.transmission && (
              <span className="rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/40">
                {listing.transmission}
              </span>
            )}
            {listing.trim && (
               <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white">
                 {listing.trim}
               </span>
            )}
            {listing.parseScore > 80 && (
               <span className="hidden xs:inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/20">
                 VERIFIED
               </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-white/5 pt-4">
            <div className="flex items-center gap-2">
               <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
               </div>
               <span className="text-[8px] sm:text-[9px] font-black text-white/20 uppercase tracking-widest">
                 Live Feed
               </span>
            </div>
            <div className="sm:hidden">
                <ComparisonToggle listing={listing} compact />
            </div>
            <ArrowRightLeft size={14} className="hidden sm:block text-white/10 group-hover:text-white transition-all" />
          </div>
        </div>
      </article>
    </ListingDetailModal>
  );
});

function ButtonIcon({ icon: Icon }: { icon: any }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyber-gradient p-[1px] shadow-neon-blue">
       <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
          <Icon size={18} className="text-foreground" />
       </div>
    </div>
  );
}

function ComparisonToggle({ listing, compact }: { listing: any, compact?: boolean }) {
  const { addToComparison, removeFromComparison, isInComparison, comparisonList } = useComparison();
  const active = isInComparison(listing.id);
  const isFull = comparisonList.length >= 4 && !active;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) {
      removeFromComparison(listing.id);
    } else if (!isFull) {
      addToComparison(listing);
    }
  };

  return (
    <button 
      onClick={toggle}
      disabled={isFull}
      className={cn(
        "flex items-center justify-center rounded-full transition-all duration-300 border",
        compact ? "h-8 w-8" : "h-10 w-10 border-2",
        active 
          ? "bg-white border-white shadow-xl animate-pulse" 
          : "bg-black/60 backdrop-blur-md border-white/20 hover:border-white hover:text-white text-white/40",
        isFull && "opacity-50 cursor-not-allowed grayscale"
      )}
    >
      {active ? <Check size={compact ? 14 : 18} className="text-black" /> : <ArrowRightLeft size={compact ? 14 : 18} />}
    </button>
  );
}
