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
  Loader2
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
  listing: Listing;
  children: React.ReactNode;
}) {
  const [listing, setListing] = React.useState<Listing>(initialListing);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
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
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 border border-primary/20">
                     <MapPin size={12} className="text-primary" />
                     <span className="text-[10px] font-bold text-foreground/80">{loc || "USA"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 border border-primary/20">
                     <Gauge size={12} className="text-primary" />
                     <span className="text-[10px] font-bold text-foreground/80">{mileage}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 border border-primary/20">
                     <Clock size={12} className="text-primary" />
                     <span className="text-[10px] font-bold text-foreground/80">{timeAgo(listing.postedAt, isRefreshing)}</span>
                  </div>
                  {isRefreshing && (
                    <div className="flex items-center gap-2 px-3 py-1 transparent-glass rounded-full border border-cyan-500/30 animate-pulse transition-all duration-300">
                      <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                        {syncStatus === "busy" ? "Queueing..." : "Syncing..."}
                      </span>
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

              {/* Description Section - More Compact */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <Info size={16} />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em]">About this vehicle</h3>
                  {isRefreshing && (
                    <span className="flex items-center gap-1 text-[8px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full animate-pulse tracking-widest ml-auto uppercase">
                      <Loader2 size={8} className="animate-spin" /> Analyzing lead timing...
                    </span>
                  )}
                </div>
                <div className={cn(
                  "rounded-2xl bg-white/5 border border-white/10 p-5 transition-all duration-500",
                  isRefreshing ? "opacity-40 blur-[2px] scale-[0.98]" : "opacity-100 blur-0 scale-100"
                )}>
                  <div className="leading-relaxed text-foreground/80 text-sm font-medium whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                    {listing.rawDescription || listing.description ? (
                      (listing.rawDescription || listing.description || "").replace(/AutoPulse local capture:\s*/, "") || "No detailed description provided."
                    ) : (
                      "Explore this vehicle on Facebook Marketplace for full details and seller information."
                    )}
                  </div>
                </div>
              </div>

              {/* Actions - Brought Higher */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button asChild className="flex-1 py-7 rounded-2xl bg-cyber-gradient text-base font-black text-black shadow-lg transition-all hover:scale-[1.02] active:scale-95">
                  <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                     VIEW ON FACEBOOK <ExternalLink size={20} />
                  </a>
                </Button>
                
                <Button variant="outline" className="sm:w-16 py-7 rounded-2xl border-white/10 hover:bg-white/10 shrink-0">
                   <Facebook size={20} className="text-primary" />
                </Button>
              </div>

              <p className="text-[9px] text-center font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                 Verified via AutoPulse Engine
              </p>
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
