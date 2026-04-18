"use client";

import * as React from "react";
import { 
  X, 
  Gauge, 
  MapPin, 
  Calendar, 
  Fuel, 
  Zap, 
  Info, 
  ExternalLink, 
  User, 
  Facebook,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Settings,
  Car,
  Palette,
  Loader2,
  Activity,
  Share2,
  History,
  TrendingUp
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Listing } from "@prisma/client";

function formatUsd(cents: number): string {
  if (cents === 0) return "FREE";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function timeAgo(date: Date | null | undefined, isRefreshing?: boolean): string {
  if (!date) return isRefreshing ? "Analyzing lead timing..." : "Publication time unknown";
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 7) return past.toLocaleDateString();
  if (diffInDays > 0) return `${diffInDays}d ago`;
  if (diffInHours > 0) return `${diffInHours}h ago`;
  if (diffInMinutes > 0) return `${diffInMinutes}m ago`;
  return "Just now";
}

export function ListingDetailModal({ 
  listing: initialListing, 
  children 
}: { 
  listing: any;
  children: React.ReactNode;
}) {
  const [listing, setListing] = React.useState<any>(initialListing);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<"idle" | "syncing" | "busy" | "error">("idle");

  React.useEffect(() => {
    const isFallback = 
      !listing.condition || 
      listing.rawDescription?.includes("AutoPulse local capture") || 
      (listing.description?.length || 0) < 100;

    if (isFallback && !isRefreshing) {
      let retryTimer: NodeJS.Timeout;

      const triggerSync = async () => {
        setIsRefreshing(true);
        setSyncStatus("syncing");

        try {
          const response = await fetch("/api/listings/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listingId: listing.id, url: listing.listingUrl }),
          });

          if (response.status === 202) {
            retryTimer = setTimeout(triggerSync, 3000);
            return;
          }

          if (response.status === 503) {
            setSyncStatus("busy");
            retryTimer = setTimeout(triggerSync, 10000);
            return;
          }

          if (!response.ok) throw new Error(`Status ${response.status}`);
          
          const data = await response.json();
          if (data?.listing) {
            setListing(data.listing);
            setIsRefreshing(false);
            setSyncStatus("idle");
          }
        } catch (err: any) {
          console.log("On-demand sync skipped or timed out:", err.message);
          setIsRefreshing(false);
          setSyncStatus("error");
        }
      };

      const initialTimer = setTimeout(triggerSync, 1200);

      return () => {
        clearTimeout(initialTimer);
        if (retryTimer) clearTimeout(retryTimer);
      };
    }
    }
  }, [
    listing.id, 
    listing.condition, 
    listing.listingUrl, 
    listing.rawDescription, 
    listing.description?.length, 
    isRefreshing
  ]);

  const hasParsedName = listing.make !== "Unknown" && listing.model !== "Unknown";
  const title = hasParsedName
    ? listing.year > 0
      ? `${listing.year} ${listing.make} ${listing.model}`
      : `${listing.make} ${listing.model}`
    : (listing.rawTitle?.trim() || "Marketplace Listing");

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null ? `${listing.mileage.toLocaleString()} mi` : "N/A";

  const specs = [
    { label: "Condition", value: listing.condition, icon: ShieldCheck },
    { label: "Transmission", value: listing.transmission, icon: Settings },
    { label: "Engine", value: listing.engine, icon: Zap },
    { label: "Drive Type", value: listing.driveType, icon: Car },
    { label: "Fuel", value: listing.fuelType, icon: Fuel },
    { label: "Trim", value: listing.trim, icon: CheckCircle2 },
    { label: "Color", value: listing.color, icon: Palette },
  ].filter(s => s.value);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-[1000px] h-[90vh] sm:h-[650px] p-0 overflow-hidden border-none bg-background/80 backdrop-blur-3xl shadow-[0_0_120px_rgba(0,0,0,0.8)] dark:shadow-[0_0_150px_rgba(0,216,255,0.15)] flex flex-col sm:flex-row rounded-[2.5rem]">
        
        {/* LEFT DECK: Sticky Media & Action Portal */}
        <div className="w-full sm:w-[45%] h-[280px] sm:h-full relative bg-black shrink-0 group">
          <img 
            src={listing.imageUrl || "/placeholder-car.svg"} 
            alt={title} 
            className="h-full w-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
          
          {/* Persistent Price & Status Area */}
          <div className="absolute bottom-10 left-10 right-10 z-20 hidden sm:block">
            <div className="mb-4">
               <span className="text-[10px] font-black tracking-[0.4em] text-cyber-blue uppercase drop-shadow-lg">
                 Current Offering
               </span>
               <div className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                 {formatUsd(listing.price)}
               </div>
            </div>
            
            <Button asChild className="w-full h-16 rounded-2xl bg-cyber-blue text-black font-black text-xs tracking-widest uppercase shadow-2xl shadow-cyan-500/30 hover:scale-[1.02] hover:bg-cyan-400 active:scale-95 transition-all border-none group/item">
              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                 VIEW ON FACEBOOK <ExternalLink size={18} className="transition-transform group-hover/item:translate-x-1" />
              </a>
            </Button>
          </div>

          {/* Top Left Vitals Indicator */}
          <div className="absolute top-8 left-8 flex flex-col gap-2">
             <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-1.5 shadow-xl">
                <div className="h-2 w-2 rounded-full bg-cyber-blue animate-pulse" />
                <span className="text-[9px] font-black text-white/90 uppercase tracking-widest">
                  {listing.source || "Facebook"} Live
                </span>
             </div>
          </div>
        </div>

        {/* RIGHT DECK: Data Feed */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-12">
            
            {/* Header Content */}
            <header className="mb-10">
               <div className="flex items-center gap-3 mb-4">
                  <span className="text-[11px] font-black tracking-[0.5em] text-cyber-blue uppercase opacity-60">
                    Vehicle Intel Profile
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-cyber-blue/40 to-transparent" />
               </div>
               <DialogTitle className="text-3xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-none mb-6">
                 {title}
               </DialogTitle>
               
               <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="h-8 rounded-lg border-white/5 bg-white/5 px-3 text-[10px] font-bold text-muted-foreground gap-2">
                    <MapPin size={12} className="text-cyber-blue" /> {loc || "USA"}
                  </Badge>
                  <Badge variant="outline" className="h-8 rounded-lg border-white/5 bg-white/5 px-3 text-[10px] font-bold text-muted-foreground gap-2">
                    <Gauge size={12} className="text-cyber-blue" /> {mileage}
                  </Badge>
                  <Badge variant="outline" className="h-8 rounded-lg border-white/5 bg-white/5 px-3 text-[10px] font-bold text-muted-foreground gap-2">
                    <Clock size={12} className="text-cyber-blue" /> {timeAgo(listing.postedAt, isRefreshing)}
                  </Badge>
                  {isRefreshing && (
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                       <Loader2 size={14} className="text-cyan-400 animate-spin" />
                    </div>
                  )}
               </div>
            </header>

            <div className="space-y-12">
              
              {/* MARKET VITALS: The Intelligence Card */}
              {listing.analysis && (
                <section>
                   <div className="flex items-center gap-2 mb-4 text-cyber-blue">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyber-blue animate-ping" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Market Vitals</h3>
                   </div>
                   <div className="relative group/intel overflow-hidden rounded-[2rem] bg-cyber-blue/5 border border-cyber-blue/20 p-8 shadow-[0_0_40px_rgba(0,216,255,0.05)]">
                      <div className="absolute top-0 right-0 p-8 opacity-10">
                         <TrendingUp size={80} className="text-cyber-blue" />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 relative z-10">
                         <div>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Market Median Index</span>
                            <div className="text-3xl font-black text-foreground tabular-nums">
                               ${(listing.analysis.medianPrice / 100).toLocaleString()}
                            </div>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">Performance Rating</span>
                            <div className={cn(
                              "text-3xl font-black italic uppercase tracking-tight",
                              listing.analysis.rating === 'great' ? "text-emerald-400" :
                              listing.analysis.rating === 'good' ? "text-cyber-blue" :
                              "text-orange-400"
                            )}>
                              {listing.analysis.rating === 'great' ? "🔥 Incredible Deal" :
                               listing.analysis.rating === 'good' ? "✨ Good Value" : "Fair Price"}
                            </div>
                         </div>
                         <div className="col-span-full pt-6 border-t border-white/10">
                            <p className="text-sm font-medium leading-relaxed text-muted-foreground/90">
                              This listing sits <span className="text-white font-black">{Math.abs(listing.analysis.diffPercent)}% {listing.analysis.diffAmount > 0 ? "below" : "above"}</span> national averages. Our engine detected potential savings of <span className="text-cyber-blue font-black">${(Math.abs(listing.analysis.diffAmount) / 100).toLocaleString()}</span> compared to local peers.
                            </p>
                         </div>
                      </div>
                   </div>
                </section>
              )}

              {/* SPECIFICATION MATRIX */}
              <section>
                <div className="flex items-center gap-2 mb-4 text-foreground/40">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Vehicle Matrix</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {specs.map((s, idx) => (
                    <div key={idx} className="flex flex-col gap-1 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group/spec">
                      <div className="flex items-center gap-2 mb-1">
                         <s.icon size={12} className="text-muted-foreground group-hover/spec:text-cyber-blue transition-colors" />
                         <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{s.label}</span>
                      </div>
                      <div className="text-sm font-bold text-foreground truncate">{s.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* INTELLIGENCE FEED (DESCRIPTION) */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-foreground/40">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Seller Intelligence</h3>
                </div>
                <div className={cn(
                  "rounded-[2rem] bg-white/5 border border-white/5 p-8 transition-all duration-500",
                  isRefreshing ? "opacity-30 blur-sm scale-[0.98]" : "opacity-100"
                )}>
                  <div className={cn(
                    "leading-relaxed text-foreground/70 text-[15px] font-medium whitespace-pre-wrap transition-all duration-700",
                    !isExpanded && "line-clamp-[4]"
                  )}>
                    {listing.rawDescription || listing.description ? (
                      (listing.rawDescription || listing.description || "").replace(/AutoPulse local capture:\s*/, "") || "No detailed dossier available."
                    ) : (
                      "Engage 'Deep Scan' via Facebook to retrieve missing telemetry data for this unit."
                    )}
                  </div>
                  
                  {((listing.rawDescription || listing.description || "").length > 200) && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-6 text-[10px] font-black text-cyber-blue uppercase tracking-[0.3em] hover:text-white flex items-center gap-2 transition-colors duration-300"
                    >
                      <History size={12} />
                      {isExpanded ? "COLLAPSE DOSSIER" : "EXPAND FULL DOSSIER"}
                    </button>
                  )}
                </div>
              </section>

            </div>
          </div>

          {/* MOBILE ONLY: Persistent Sticky Footer */}
          <div className="sm:hidden p-6 bg-background/90 backdrop-blur-3xl border-t border-white/5">
             <Button asChild className="w-full h-14 rounded-2xl bg-cyber-blue text-black font-black text-xs tracking-widest uppercase shadow-xl hover:bg-cyan-400 border-none">
                <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                   VIEW ON FACEBOOK — {formatUsd(listing.price)}
                </a>
             </Button>
          </div>
          
          {/* Universal Share Portal */}
          <div className="px-12 py-8 flex items-center justify-between border-t border-white/5 bg-black/10 hidden sm:flex">
             <div className="flex items-center gap-2 text-muted-foreground/30">
                <ShieldCheck size={14} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Validated by AutoPulse Core</span>
             </div>
             <div className="flex gap-4">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-white hover:bg-white/5">
                   <Share2 size={18} />
                </Button>
             </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoChip({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/5 dark:bg-white/5 p-4 border border-black/5 dark:border-white/5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</div>
        <div className="text-sm font-bold text-foreground truncate max-w-[120px] tracking-tight">{value}</div>
      </div>
    </div>
  );
}
