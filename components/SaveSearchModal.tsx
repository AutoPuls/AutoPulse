"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchFilters } from "@/components/SearchFiltersContext";
import { useToast } from "@/components/ui/use-toast";

function formatFilterSummary(f: {
  keywords: string;
  make: string;
  model: string;
  yearMin: string;
  yearMax: string;
  priceMin: string;
  priceMax: string;
  mileageMax: string;
  city: string;
}): string {
  const parts: string[] = [];
  if (f.keywords) parts.push(`Keywords: ${f.keywords}`);
  if (f.make) parts.push(`Make: ${f.make}`);
  if (f.model) parts.push(`Model: ${f.model}`);
  
  if (f.yearMin || f.yearMax) {
    parts.push(`Year: ${f.yearMin || "…"} – ${f.yearMax || "…"}`);
  }
  if (f.priceMin || f.priceMax) {
    parts.push(`Price: $${f.priceMin || "…"} – $${f.priceMax || "…"}`);
  }
  if (f.mileageMax) parts.push(`Max mileage: ${f.mileageMax}`);
  if (f.city) parts.push(`City: ${f.city}`);
  return parts.length ? parts.join(" · ") : "Any vehicle (no filters)";
}

export function SaveSearchModal(): React.ReactElement {
  const { filters, alertOpen, setAlertOpen } = useSearchFilters();
  const { toast } = useToast();
  const [step, setStep] = React.useState(1);
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Local state for alert customization
  const [make, setMake] = React.useState("");
  const [model, setModel] = React.useState("");
  const [priceMin, setPriceMin] = React.useState("");
  const [priceMax, setPriceMax] = React.useState("");
  const [keywords, setKeywords] = React.useState("");

  // Sync with global filters when modal opens
  React.useEffect(() => {
    if (alertOpen) {
      setMake(filters.make || "");
      setModel(filters.model || "");
      setPriceMin(filters.priceMin || "");
      setPriceMax(filters.priceMax || "");
      setKeywords(filters.keywords || "");
    }
  }, [alertOpen, filters]);

  // Load email from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("autopulse_user_email");
    if (saved) setEmail(saved);
  }, []);

  // Persist email when it changes
  React.useEffect(() => {
    if (email) localStorage.setItem("autopulse_user_email", email);
  }, [email]);

  // Reset step to 1 when modal closes
  React.useEffect(() => {
     if (!alertOpen) setStep(1);
  }, [alertOpen]);

  async function onSave(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        email,
        make: make || undefined,
        model: model || undefined,
        yearMin: filters.yearMin ? Number(filters.yearMin) : undefined,
        yearMax: filters.yearMax ? Number(filters.yearMax) : undefined,
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        mileageMax: filters.mileageMax ? Number(filters.mileageMax) : undefined,
        city: filters.city || undefined,
        keywords: keywords ? [keywords] : undefined, // Keywords are sent as array
      };

      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Could not save alert";
        toast({
          variant: "destructive",
          title: "Error",
          description: err,
        });
        return;
      }

      toast({
        variant: "success",
        title: "Sentinel Activated!",
        description: `We'll transmit matches to ${email}`,
      });
      setAlertOpen(false);
      setEmail("");
      setStep(1);
    } catch {
      toast({
        variant: "destructive",
        title: "System Error",
        description: "Network uplink failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
      <DialogContent className="sm:max-w-md bg-background border border-white/10 rounded-[2rem] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-white/[0.03] blur-[50px] pointer-events-none" />

        <DialogHeader className="mb-4 relative z-10">
          <DialogTitle className="text-3xl font-black tracking-tight text-white font-display uppercase italic">
             {step === 1 ? "Sentinel Target Config" : "Uplink Target"}
          </DialogTitle>
          <DialogDescription className="text-white/40 mt-2 font-medium uppercase text-[10px] tracking-widest">
             {step === 1 
               ? "Define the vehicle criteria our scanners should hunt for." 
               : "Enter your email. We'll ping you the second a matching vehicle enters our national database."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 relative z-10">
          
          {step === 1 ? (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Make</Label>
                    <Input value={make} onChange={e => setMake(e.target.value)} placeholder="E.G. BMW" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/[0.02] border-white/5 focus-visible:ring-white/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Model</Label>
                    <Input value={model} onChange={e => setModel(e.target.value)} placeholder="E.G. M3" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/[0.02] border-white/5 focus-visible:ring-white/20" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Min Price ($)</Label>
                    <Input value={priceMin} onChange={e => setPriceMin(e.target.value)} type="number" placeholder="5000" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/[0.02] border-white/5 focus-visible:ring-white/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Max Price ($)</Label>
                    <Input value={priceMax} onChange={e => setPriceMax(e.target.value)} type="number" placeholder="50000" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/[0.02] border-white/5 focus-visible:ring-white/20" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Hunt Keywords</Label>
                  <Input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="E.G. 'CLEAN TITLE', 'MANUAL'" className="h-10 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/[0.02] border-white/5 focus-visible:ring-white/20" />
                </div>
                
                <Button
                  onClick={() => setStep(2)}
                  className="w-full h-14 rounded-full bg-white text-black font-black uppercase tracking-widest shadow-2xl transition-transform hover:scale-[1.02] active:scale-95"
                >
                  Confirm Parameters
                </Button>
             </div>
          ) : (
             <form className="space-y-6 animate-in slide-in-from-right-4 duration-300" onSubmit={onSave}>
                <div className="space-y-3">
                  <Label htmlFor="alert-email" className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
                    Transmission Email Address
                  </Label>
                  <Input
                    id="alert-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="PILOT@EXAMPLE.COM"
                    className="h-12 rounded-xl bg-white/[0.03] border-white/5 text-white text-[11px] font-black uppercase tracking-widest placeholder:text-white/10 focus-visible:ring-white/20"
                    autoComplete="email"
                  />
                </div>
                
                <div className="flex gap-3">
                   <Button
                     type="button"
                     onClick={() => setStep(1)}
                     variant="ghost"
                     className="h-14 w-20 rounded-2xl flex-shrink-0 text-white/20 hover:text-white hover:bg-white/5 border border-white/10"
                   >
                     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                   </Button>
                   <Button
                     type="submit"
                     disabled={loading}
                     className="w-full h-14 rounded-2xl bg-white text-black font-black uppercase tracking-widest shadow-2xl transition-transform hover:scale-[1.02] active:scale-95"
                   >
                     {loading ? "INITIALIZING..." : "INITIATE PROTOCOL"}
                   </Button>
                </div>
             </form>
          )}
          
        </div>
      </DialogContent>
    </Dialog>
  );
}
