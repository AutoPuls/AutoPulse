"use client";

import React from "react";
import { useComparison } from "@/context/ComparisonContext";
import { X, ArrowRight, Gauge, MapPin, Zap, ShieldCheck, DollarSign, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ComparisonOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { comparisonList, removeFromComparison } = useComparison();

  if (!isOpen) return null;

  const specs = [
    { label: "Price", key: "price", icon: DollarSign, format: (v: number) => `$${(v / 100).toLocaleString()}` },
    { label: "Mileage", key: "mileage", icon: Gauge, format: (v: number) => v != null ? `${v.toLocaleString()} mi` : "—" },
    { label: "Year", key: "year", icon: Check, format: (v: number) => v || "—" },
    { label: "Transmission", key: "transmission", icon: Zap, format: (v: string) => v || "—" },
    { label: "Title", key: "titleStatus", icon: ShieldCheck, format: (v: string) => v || "Clean" },
    { label: "Location", key: "city", icon: MapPin, format: (v: string) => v || "USA" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-6 bg-background/40 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className="relative h-full w-full max-w-7xl overflow-hidden bg-background border border-border shadow-modal flex flex-col sm:rounded-3xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 sm:px-10 sm:py-8 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Intelligence Protocol</p>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">Battle Station</h2>
          </div>
          <button 
            onClick={onClose}
            className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-surface border border-border text-muted-foreground hover:text-foreground transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Comparison Grid */}
        <div className="flex-1 overflow-auto p-6 sm:p-10 custom-scrollbar">
          <div className="flex gap-4 sm:gap-6 min-w-max sm:min-w-0">
            {comparisonList.map((item) => (
              <div key={item.id} className="flex flex-col gap-6 w-[280px] sm:flex-1 shrink-0">
                
                {/* Visual Header */}
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-surface shadow-sm group">
                   <img 
                    src={item.imageUrls?.[0] || item.imageUrl} 
                    alt={item.make} 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                   <div className="absolute bottom-4 left-4 right-4 text-left">
                      <h3 className="text-sm font-bold text-white leading-tight truncate">
                         {item.year || ""} {item.make || ""} {item.model || "Vehicle"}
                      </h3>
                      <p className="text-[10px] font-medium text-white/60 truncate mt-0.5">{item.city || "USA"}</p>
                   </div>
                   <button 
                     onClick={() => removeFromComparison(item.id)}
                     className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                   >
                     <X size={14} />
                   </button>
                </div>

                {/* Specs */}
                <div className="space-y-2">
                  {specs.map((spec) => (
                    <div key={spec.key} className="flex flex-col gap-1 p-3.5 rounded-xl bg-surface/50 border border-border hover:bg-surface transition-colors group/spec">
                       <div className="flex items-center gap-1.5 text-muted-foreground">
                          <spec.icon size={11} className="text-primary group-hover/spec:scale-110 transition-transform" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">{spec.label}</span>
                       </div>
                       <div className={cn(
                         "text-sm font-bold truncate",
                         spec.key === 'price' ? "text-primary text-base" : "text-foreground"
                        )}>
                         {(spec.format as any)(item[spec.key])}
                       </div>
                    </div>
                  ))}
                </div>

                {/* Open Action */}
                <a 
                    href={item.listingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-auto h-12 flex items-center justify-center gap-2 rounded-xl bg-surface border border-border text-foreground hover:bg-primary hover:text-white hover:border-primary transition-all text-xs font-bold uppercase tracking-wider group/btn"
                >
                    View Listing <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
                </a>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, 4 - comparisonList.length) }).map((_, i) => (
               <div key={`empty-${i}`} className="hidden sm:flex flex-1 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-surface/30 p-10 text-center gap-4">
                  <div className="h-14 w-14 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground/30">
                     <Plus size={24} />
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Available Slot</p>
               </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 sm:px-10 bg-surface border-t border-border flex items-center justify-center">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.3em] opacity-40">AutoPulse Battle Station — Active Unit Comparison Grid</p>
        </div>
      </div>
    </div>
  );
}
