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
  Activity
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
    // If the modal is already open, and we haven't synced yet, try to sync
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
            // Already syncing - just wait and check again soon
            console.log("Server already syncing this car. Waiting...");
            retryTimer = setTimeout(triggerSync, 3000);
            return;
          }

          if (response.status === 503) {
            // Server Busy - wait a bit longer to be polite
            console.log("Server busy. Queuing retry in 10s...");
            setSyncStatus("busy");
            retryTimer = setTimeout(triggerSync, 10000);
            return;
          }

          if (!response.ok) {
            throw new Error(`Status ${response.status}`);
          }

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

      // 1.2s Initial Debounce
      const initialTimer = setTimeout(triggerSync, 1200);

      return () => {
        clearTimeout(initialTimer);
        if (retryTimer) clearTimeout(retryTimer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

  const hasParsedName =
    listing.make !== "Unknown" &&
    listing.model !== "Unknown";
  const fallbackTitle =
    (listing.rawTitle && listing.rawTitle.trim().length > 0
      ? listing.rawTitle.trim()
      : "Marketplace Listing");
  const title = hasParsedName
    ? listing.year > 0
      ? `${listing.year} ${listing.make} ${listing.model}`
      : `${listing.make} ${listing.model}`
    : fallbackTitle;

  const loc = [listing.city, listing.state].filter(Boolean).join(", ");
  const mileage = listing.mileage != null
    ? `${listing.mileage.toLocaleString()} mi`
    : "N/A";

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
      <DialogContent className="max-w-[95vw] sm:max-w-[700px] max-h-[85vh] p-0 overflow-hidden border-none bg-background/60 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.6)] dark:shadow-[0_0_100px_rgba(0,216,255,0.2)] duration-500 rounded-[2rem]">
        
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pb-6">
          
          {/* Top Visual Section: More Compact Hero Image */}
          <div className="relative w-full aspect-[21/9] sm:aspect-[2.4/1] bg-black shrink-0 group overflow-hidden">
            <img 
              src={listing.imageUrl || "/placeholder-car.svg"} 
              alt={title} 
              className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
            />
            
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-95" />
            
            {/* Top Badge Strip - Smaller */}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="inline-flex rounded-full bg-cyber-blue shadow-[0_0_15px_rgba(0,216,255,0.8)] px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-black">
                {listing.year || "Listing"}
              </span>
              <span className="inline-flex rounded-full bg-white/10 backdrop-blur-lg border border-white/20 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white">
                {listing.make}
              </span>
            </div>

            {/* Price Badge - Compacted */}
            <div className="absolute bottom-4 right-6">
               <div className="text-3xl sm:text-4xl font-black tracking-tighter text-cyber-blue drop-shadow-[0_0_20px_rgba(0,216,255,0.6)]">
                 {formatUsd(listing.price)}
               </div>
            </div>

            {/* QUICK ACTION HEADER BUTTON (NEW) */}
            <div className="absolute top-4 right-4 flex gap-2">
               <Button asChild className="h-10 rounded-full bg-cyber-blue text-[10px] font-black text-black px-5 shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95 border-none">
                  <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                     VIEW ON FACEBOOK <ExternalLink size={14} />
                  </a>
               </Button>
            </div>
          </div>

          <div className="px-5 sm:px-10 py-6">
            <div className="flex flex-col gap-6">
              
              {/* Header Title & Basic Info - Tighter */}
              <div className="space-y-2">
                <DialogTitle className="text-2xl sm:text-3xl font-black leading-tight tracking-tight text-foreground font-display uppercase italic mb-2">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-70">
                  Full vehicle specifications and seller details
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 border border-white/5">
                     <MapPin size={10} className="text-primary" />
                     <span className="text-[9px] font-bold text-foreground/70">{loc || "USA"}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 border border-white/5">
                     <Gauge size={10} className="text-primary" />
                     <span className="text-[9px] font-bold text-foreground/70">{mileage}</span>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 border border-white/5">
                     <Clock size={10} className="text-primary" />
                     <span className="text-[9px] font-bold text-foreground/70">{timeAgo(listing.postedAt, isRefreshing)}</span>
                  </div>
                  {isRefreshing && (
                    <div className="flex items-center gap-2 px-2.5 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/30 animate-pulse">
                      <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Specs Grid - Smaller Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {specs.map((s, idx) => (
                  <div key={idx} className="flex flex-col gap-0.5 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-primary/40 transition-colors group">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{s.label}</span>
                    <div className="text-[13px] font-bold text-foreground truncate">{s.value}</div>
                  </div>
                ))}
              </div>
              {/* MARKET INTELLIGENCE SECTION */}
              {listing.analysis && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-cyber-blue">
                    <Activity size={16} className="animate-pulse" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">Market Intelligence</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl bg-cyber-blue/5 border border-cyber-blue/20 p-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Market Value Index</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-foreground">
                          ${(listing.analysis.medianPrice / 100).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">15-city median</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">AutoPulse Rating</span>
                      <div className={cn(
                        "text-xl font-black italic uppercase tracking-tight",
                        listing.analysis.rating === 'great' ? "text-emerald-400" :
                        listing.analysis.rating === 'good' ? "text-cyber-blue" :
                        "text-orange-400"
                      )}>
                        {listing.analysis.rating === 'great' ? "🔥 Incredible Deal" :
                         listing.analysis.rating === 'good' ? "✨ Great Value" : "Fair Price"}
                      </div>
                    </div>
                    <div className="col-span-full border-t border-white/10 pt-4 mt-1">
                      <p className="text-[11px] font-medium leading-relaxed text-muted-foreground/80">
                        This vehicle is priced <span className="text-foreground font-bold">{Math.abs(listing.analysis.diffPercent)}% {listing.analysis.diffAmount > 0 ? "below" : "above"}</span> the current market median for {listing.year} {listing.make} {listing.model} listings across the United States.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description Section - Show More Logic */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Info size={14} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">About this vehicle</h3>
                </div>
                <div className={cn(
                  "rounded-2xl bg-white/5 border border-white/10 p-5 relative overflow-hidden transition-all duration-500",
                  isRefreshing ? "opacity-40 blur-[2px] scale-[0.98]" : "opacity-100 blur-0 scale-100"
                )}>
                  <div className={cn(
                    "leading-relaxed text-foreground/80 text-sm font-medium whitespace-pre-wrap transition-all duration-500",
                    !isExpanded && "line-clamp-3"
                  )}>
                    {listing.rawDescription || listing.description ? (
                      (listing.rawDescription || listing.description || "").replace(/AutoPulse local capture:\s*/, "") || "No detailed description provided."
                    ) : (
                      "Explore this vehicle on Facebook Marketplace for full details and seller information."
                    )}
                  </div>
                  
                  {((listing.rawDescription || listing.description || "").length > 150) && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-3 text-[10px] font-black text-cyber-blue uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      {isExpanded ? "Show Less" : "Show More"}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                   Verified via AutoPulse Engine
                </p>
                <div className="flex gap-2">
                   <Button variant="outline" className="h-8 rounded-lg border-white/10 hover:bg-white/10 text-[9px] font-bold px-3">
                      SHARE
                   </Button>
                </div>
              </div>
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

// Icons for the grid
function SettingsIcon(props: any) { return <Zap {...props} /> }
function CarIcon(props: any) { return <CheckCircle2 {...props} /> }
function PaletteIcon(props: any) { return <div className="h-4 w-4 rounded-full border border-white/20 bg-gradient-to-tr from-cyber-blue to-cyber-purple" {...props} /> }
