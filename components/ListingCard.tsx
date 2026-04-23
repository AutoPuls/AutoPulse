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
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#00D8FF" opacity="0.3" font-family="system-ui" font-weight="900" font-size="40" letter-spacing="0.2em">AUTOPULSE</text>
      <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" fill="#888" opacity="0.5" font-family="system-ui" font-weight="500" font-size="14" letter-spacing="0.1em">VISUAL CAPTURE PENDING</text>
    </svg>`,
  );

export const ListingCard = memo(function ListingCard({ listing }: { listing: any }): React.ReactElement {
  const [imgOk, setImgOk] = useState(true);
  const src = (listing.imageUrls && listing.imageUrls.length > 0) && imgOk ? listing.imageUrls[0] : placeholderSvg;

  const hasParsedMake = listing.make !== "Unknown";
  const hasParsedModel = listing.model !== "Unknown";

  const fallbackTitle =
    (listing.rawTitle && listing.rawTitle.trim().length > 0
      ? listing.rawTitle.trim()
      : "Marketplace Listing");

  let title = fallbackTitle;
  if (hasParsedMake) {
    const yearPrefix = listing.year > 0 ? `${listing.year} · ` : "";
    const modelSuffix = hasParsedModel ? ` · ${listing.model}` : "";
    title = `${yearPrefix}${listing.make}${modelSuffix}`;
  }

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null
    ? `${(listing.mileage / 1000).toFixed(1)}k mi`
    : "N/A";

  return (    <ListingDetailModal listing={listing}>
      <article className="group relative flex flex-col overflow-hidden rounded-[2.5rem] bg-card/40 backdrop-blur-3xl ring-1 ring-white/5 transition-all duration-700 hover:shadow-[0_0_80px_rgba(0,216,255,0.25)] hover:-translate-y-3 hover:ring-cyber-blue/50 cursor-pointer active:scale-[0.98] border border-white/5">
        
        {/* Visual Engine */}
        <div className="relative aspect-[4/3] w-full overflow-hidden shrink-0">
          <Image
            src={src}
            alt={title}
            fill
            className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.2]"
            onError={() => setImgOk(false)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          
          {/* Overlays - Immersive Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-black/20 opacity-100 transition-opacity duration-700 group-hover:opacity-40" />
          
          {/* FLOATING PRICE BADGE (NEW) */}
          <div className="absolute right-6 top-6 z-30">
             <div className="rounded-2xl bg-cyber-blue px-4 py-2 shadow-[0_0_30px_rgba(0,216,255,0.6)] transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                <p className="text-xl font-black tracking-tighter text-black leading-none">
                  {formatUsd(listing.price)}
                </p>
             </div>
          </div>

          {/* DEAL INTEL - MOVED TO TOP LEFT */}
          {listing.analysis && listing.analysis.rating !== 'unknown' && (
            <div className="absolute left-6 top-6 z-20">
              <div className={cn(
                "flex h-8 items-center justify-center rounded-xl px-4 text-[9px] font-black tracking-[0.2em] shadow-2xl backdrop-blur-xl border uppercase italic transition-all duration-500 group-hover:-translate-y-1",
                listing.analysis.rating === 'great' ? "bg-emerald-500/90 text-white border-emerald-400" :
                listing.analysis.rating === 'good' ? "bg-white/10 text-cyber-blue border-cyber-blue/50" :
                "bg-orange-500/80 text-white border-orange-400"
              )}>
                {listing.analysis.rating === 'great' ? "🔥 GREAT DEAL" : 
                 listing.analysis.rating === 'good' ? "✨ GOOD VALUE" : "FAIR PRICE"}
              </div>
            </div>
          )}
          
          {/* HIGH-DENSITY SPEC BAR (NEW) */}
          <div className="absolute bottom-6 inset-x-6 z-20 flex gap-2">
            <div className="flex flex-1 items-center gap-3 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10 px-4 py-2.5 shadow-xl transition-all duration-500 group-hover:bg-cyber-blue/10 group-hover:border-cyber-blue/30 overflow-hidden">
               <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
                  <Gauge size={12} className="text-cyber-blue" />
                  <span className="text-[10px] font-black tracking-widest text-white/90">{mileage}</span>
               </div>
               <div className="flex items-center gap-1.5 truncate">
                  <MapPin size={12} className="text-cyber-blue" />
                  <span className="text-[10px] font-black tracking-widest text-white/90 truncate">{listing.city || "USA"}</span>
               </div>
            </div>
            
            <div className="flex shrink-0 translate-y-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 gap-1.5">
               <ComparisonToggle listing={listing} />
            </div>
          </div>

          {/* HOLOGRAPHIC SHIMMER */}
          <div className="absolute inset-x-0 top-0 h-[100%] w-[100%] -translate-x-[150%] skew-x-[-30deg] bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-[1500ms] group-hover:translate-x-[150%] z-40" />
        </div>

        {/* Content Body - Refined Typography */}
        <div className="relative z-10 flex flex-1 flex-col px-8 pb-8 pt-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-[9px] font-black tracking-[0.3em] text-cyber-blue uppercase opacity-60">
                 {listing.year || "New Entry"}
               </span>
               <div className="h-px flex-1 bg-gradient-to-r from-cyber-blue/30 to-transparent" />
            </div>
            <h2 className="line-clamp-2 font-display text-2xl font-black leading-[1.1] tracking-tight text-foreground group-hover:text-cyber-blue transition-colors duration-500 uppercase italic">
              {title}
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5 opacity-80 group-hover:opacity-100 transition-opacity">
            {listing.transmission && (
              <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">
                {listing.transmission}
              </span>
            )}
            {listing.trim && (
               <span className="rounded-full bg-cyber-blue/10 border border-cyber-blue/20 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-cyber-blue">
                 {listing.trim}
               </span>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
               <div className="h-6 w-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-cyber-blue animate-pulse" />
               </div>
               <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                 Live Analysis active
               </span>
            </div>
            <ArrowRightLeft size={16} className="text-white/20 group-hover:text-cyber-blue group-hover:scale-110 transition-all" />
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

function ComparisonToggle({ listing }: { listing: any }) {
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
        "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 border-2",
        active 
          ? "bg-cyber-blue border-white shadow-[0_0_20px_rgba(0,216,255,0.6)] animate-pulse" 
          : "bg-black/60 backdrop-blur-md border-white/20 hover:border-cyber-blue hover:text-cyber-blue text-white",
        isFull && "opacity-50 cursor-not-allowed grayscale"
      )}
    >
      {active ? <Check size={18} className="text-black" /> : <ArrowRightLeft size={18} />}
    </button>
  );
}
