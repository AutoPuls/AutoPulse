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
  TrendingUp,
  FileText,
  AlertTriangle
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
  if (!date) return isRefreshing ? "Analyzing lead timing..." : "Lead Intake Verified";
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
      listing.rawDescription?.toLowerCase().includes("connectez-vous") ||
      listing.rawDescription?.toLowerCase().includes("log in to") ||
      listing.description?.toLowerCase().includes("connectez-vous") ||
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
  }, [
    listing.id, 
    listing.condition, 
    listing.listingUrl, 
    listing.rawDescription, 
    listing.description, 
    listing.description?.length, 
    isRefreshing
  ]);

  const hasParsedMake = listing.make !== "Unknown";
  const hasParsedModel = listing.model !== "Unknown";
  const isGeneric = (listing.rawTitle || "").toLowerCase().includes("marketplace listing");
  
  const title = (hasParsedMake || listing.year > 0)
    ? `${listing.year > 0 ? listing.year + ' ' : ''}${hasParsedMake ? listing.make : 'Vehicle'}${hasParsedModel ? ' ' + listing.model : ''}`
    : (isGeneric ? "Vehicle Intelligence Report" : (listing.rawTitle?.trim() || "Automotive Entry"));

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null ? `${listing.mileage.toLocaleString()} mi` : "N/A";

  const specs = [
    { label: "Condition", value: listing.condition, icon: ShieldCheck },
    { label: "Title", value: listing.titleStatus || "Unknown", icon: FileText },
    { label: "Transmission", value: listing.transmission, icon: Settings },
    { label: "Drive Type", value: listing.driveType, icon: Car },
    { label: "Fuel", value: listing.fuelType, icon: Fuel },
    { label: "Engine", value: listing.engine, icon: Zap },
    { label: "Body Style", value: listing.bodyStyle, icon: Car },
    { label: "Trim", value: listing.trim, icon: CheckCircle2 },
    { label: "VIN", value: listing.vin, icon: ShieldCheck },
    { label: "Interior", value: listing.features?.find((f: string) => f.includes('interior'))?.replace(' interior', ''), icon: Palette },
    { label: "Color", value: listing.color, icon: Palette },
    { label: "Owners", value: listing.owners ? `${listing.owners} owner${listing.owners > 1 ? 's' : ''}` : null, icon: User },
    { label: "Accidents", value: listing.accidents === false ? "Accident Free" : listing.accidents === true ? "Reported" : null, icon: AlertTriangle },
  ].filter(s => s.value);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-[100vw] sm:max-w-[1000px] h-full sm:h-[650px] p-0 overflow-hidden border-none bg-background sm:bg-background/80 backdrop-blur-3xl shadow-2xl flex flex-col sm:flex-row rounded-none sm:rounded-[2.5rem]">
        
        {/* LEFT DECK: Sticky Media & Action Portal */}
        <div className="w-full sm:w-[45%] h-[240px] sm:h-full relative bg-black shrink-0 group">
          <img 
            src={(listing.imageUrls && listing.imageUrls.length > 0) ? listing.imageUrls[0] : "/placeholder-car.svg"} 
            alt={title} 
            className="h-full w-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/40 to-transparent" />
          
          {/* Mobile Price Overlay */}
          <div className="absolute bottom-4 left-6 z-20 sm:hidden">
             <div className="text-3xl font-black tracking-tighter text-white drop-shadow-lg">
                {formatUsd(listing.price)}
             </div>
          </div>

          {/* Persistent Price Area (Desktop) */}
          <div className="absolute bottom-10 left-10 right-10 z-20 hidden sm:block">
            <div className="mb-4">
               <span className="text-[10px] font-black tracking-[0.4em] text-white/40 uppercase drop-shadow-lg">
                 Current Offering
               </span>
               <div className="text-5xl font-black tracking-tighter text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                 {formatUsd(listing.price)}
               </div>
            </div>
            
            <Button asChild className="w-full h-16 rounded-2xl bg-white text-black font-black text-xs tracking-widest uppercase shadow-2xl hover:scale-[1.02] hover:bg-white active:scale-95 transition-all border-none group/item">
              <a 
                href={listing.listingUrl || `https://www.facebook.com/marketplace/item/${listing.externalId}/`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center justify-center gap-2"
              >
                 VIEW ON FACEBOOK <ExternalLink size={18} className="transition-transform group-hover/item:translate-x-1" />
              </a>
            </Button>
          </div>

          {/* Top Left Vitals Indicator */}
          <div className="absolute top-4 left-4 sm:top-8 sm:left-8 flex flex-col gap-2">
             <div className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1 sm:px-4 sm:py-1.5 shadow-xl">
                <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-white animate-pulse" />
                <span className="text-[8px] sm:text-[9px] font-black text-white/90 uppercase tracking-widest">
                  {listing.source || "Facebook"} Live
                </span>
             </div>
          </div>
        </div>

        {/* RIGHT DECK: Data Feed */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-background/50 backdrop-blur-md">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-12">
            
            {/* Header Content */}
            <header className="mb-8 sm:mb-10">
               <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <span className="text-[9px] sm:text-[11px] font-black tracking-[0.4em] text-white/40 uppercase">
                    Vehicle Intel Profile
                  </span>
                  <div className="h-px flex-1 bg-white/[0.05]" />
               </div>
               <DialogTitle className="text-2xl sm:text-5xl font-black tracking-tighter text-foreground uppercase italic leading-tight mb-4 sm:mb-6">
                 {title}
               </DialogTitle>
               
               <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Badge variant="outline" className="h-7 sm:h-8 rounded-lg border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 px-2.5 sm:px-3 text-[9px] sm:text-[10px] font-bold text-muted-foreground gap-1.5">
                    <MapPin size={10} className="text-white/40" /> {loc || "USA"}
                  </Badge>
                  <Badge variant="outline" className="h-7 sm:h-8 rounded-lg border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 px-2.5 sm:px-3 text-[9px] sm:text-[10px] font-bold text-muted-foreground gap-1.5">
                    <Gauge size={10} className="text-white/40" /> {mileage}
                  </Badge>
                  <Badge variant="outline" className="h-7 sm:h-8 rounded-lg border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 px-2.5 sm:px-3 text-[9px] sm:text-[10px] font-bold text-muted-foreground gap-1.5">
                    <Clock size={10} className="text-white/40" /> {timeAgo(listing.postedAt, isRefreshing)}
                  </Badge>
                  {isRefreshing && (
                    <div className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10">
                       <Loader2 size={12} className="text-white animate-spin" />
                    </div>
                  )}
               </div>
            </header>

            <div className="space-y-12">
              
              {/* MARKET VITALS: The Intelligence Card */}
              {listing.analysis && (
                <section>
                   <div className="flex items-center gap-2 mb-4 text-white/40">
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Market Vitals</h3>
                   </div>
                   <div className="relative group/intel overflow-hidden rounded-2xl sm:rounded-[2rem] bg-white/[0.03] border border-white/10 p-5 sm:p-8 shadow-2xl">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                         <TrendingUp size={80} className="text-white" />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 relative z-10">
                         <div>
                            <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Market Median</span>
                            <div className="text-xl sm:text-3xl font-black text-foreground tabular-nums leading-tight">
                               ${(listing.analysis.medianPrice / 100).toLocaleString()}
                            </div>
                         </div>
                         <div>
                            <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">Deal Quality</span>
                            <div className={cn(
                               "text-xl sm:text-3xl font-black italic uppercase tracking-tight leading-tight",
                               listing.analysis.rating === 'great' ? "text-white" :
                               listing.analysis.rating === 'good' ? "text-white/60" :
                               "text-white/40"
                             )}>
                               {listing.analysis.rating === 'great' ? "🔥🔥 PRIORITY" :
                                listing.analysis.rating === 'good' ? "✨ TARGET" : "NODE"}
                            </div>
                         </div>
                         <div className="col-span-full pt-4 sm:pt-6 border-t border-white/10">
                            <p className="text-[12px] sm:text-sm font-medium leading-relaxed text-muted-foreground/90">
                               Sitting <span className="text-white font-black">{Math.abs(listing.analysis.diffPercent)}% {listing.analysis.diffAmount > 0 ? "below" : "above"}</span> national averages. Detected potential savings of <span className="text-white font-black">${(Math.abs(listing.analysis.diffAmount) / 100).toLocaleString()}</span>.
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
                  {specs.map((s, idx) => (
                    <div key={idx} className="flex flex-col gap-1 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-white/20 transition-all group/spec">
                      <div className="flex items-center gap-2 mb-1">
                         <s.icon size={10} className="text-muted-foreground group-hover/spec:text-white transition-colors" />
                         <span className="text-[8px] sm:text-[9px] font-black text-muted-foreground uppercase tracking-widest">{s.label}</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-foreground truncate">{s.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* FEATURE TAGS */}
              {listing.features && listing.features.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4 text-foreground/40">
                     <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Premium Features</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listing.features.map((feat: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="h-8 rounded-lg border-white/10 bg-white/5 px-3 text-[10px] font-black text-white/60 uppercase tracking-widest">
                        {feat}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* INTELLIGENCE FEED (DESCRIPTION) */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-foreground/40">
                   <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">Seller Intelligence</h3>
                </div>
                <div className={cn(
                  "rounded-[2rem] bg-white/[0.03] border border-white/5 p-8 transition-all duration-500",
                  isRefreshing ? "opacity-30 blur-sm scale-[0.98]" : "opacity-100"
                )}>
                  <div className={cn(
                    "leading-relaxed text-foreground/70 text-[15px] font-medium whitespace-pre-wrap transition-all duration-700",
                    !isExpanded && "line-clamp-3 overflow-hidden"
                  )}>
                    {(() => {
                      const desc = (listing.rawDescription || listing.description || "");
                      if (desc.toLowerCase().includes("connectez-vous") || desc.toLowerCase().includes("log in to")) {
                          return "Detailed telemetry pending (Login Wall detected). Deep scan initiated...";
                      }
                      const cleanDesc = desc.replace(/AutoPulse (local capture|v8 captured):\s*/i, "").trim();
                      return cleanDesc || "Detailed telemetry pending.";
                    })()}
                  </div>
                  
                  {((listing.rawDescription || listing.description || "").length > 200) && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-6 text-[10px] font-black text-white/40 uppercase tracking-[0.3em] hover:text-white flex items-center gap-2 transition-colors duration-300"
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
             <Button asChild className="w-full h-14 rounded-2xl bg-white text-black font-black text-xs tracking-widest uppercase shadow-xl hover:bg-white border-none">
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
