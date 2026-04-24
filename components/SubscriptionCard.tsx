"use client";

import React, { useState } from "react";
import { 
  Car, 
  Trash2, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Gauge, 
  Clock, 
  Zap,
  Mail,
  Pencil,
  Check,
  X 
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

function formatUsdFromCents(cents: number | null): string {
  if (cents == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function ConfigRow({ icon: Icon, value }: { icon: any, value: string }) {
  return (
    <div className="flex items-center gap-3">
       <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/20 transition-colors group-hover:text-white">
          <Icon size={14} />
       </div>
       <span className="text-[10px] font-black uppercase tracking-widest text-white/40 truncate tracking-tight">{value}</span>
    </div>
  );
}

export function SubscriptionCard({ subscription: s }: { subscription: any }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState(s.email);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const { toast } = useToast();
  const router = useRouter();

  const title = [s.make, s.model].filter(Boolean).join(" ") || "All Vehicles";

  async function handleDelete() {
    if (!confirm(`Stop monitoring for ${title}?`)) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/subscriptions/${s.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Deletion failed");

      toast({
        variant: "success",
        title: "Sentinel Deactivated",
        description: `Monitoring for ${title} has been terminated.`,
      });
      router.refresh();
    } catch (error) {
       toast({
        variant: "destructive",
        title: "System Error",
        description: "Could not terminate Sentinel signal.",
      });
      setIsDeleting(true); // Keep grayscale
    }
  }

  async function handleUpdateEmail() {
    if (newEmail === s.email) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/subscriptions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });

      if (!res.ok) throw new Error("Update failed");

      toast({
        variant: "success",
        title: "Protocol Updated",
        description: `Uplink target changed to ${newEmail}`,
      });
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Uplink Error",
        description: "Failed to update transmission target.",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <article className={`group relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0A0C0F]/80 p-8 backdrop-blur-3xl shadow-2xl transition-all duration-500 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_0_80px_rgba(255,255,255,0.05)] ${isDeleting ? "opacity-40 grayscale pointer-events-none scale-95" : ""}`}>
      
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 h-[300px] w-[300px] -translate-y-1/2 translate-x-1/3 rounded-full bg-white/[0.02] blur-[80px] pointer-events-none opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

      <div className="relative z-10">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/50 border border-white/10 text-white shadow-inner transition-transform group-hover:scale-110 group-hover:border-white/40">
             <Car size={26} strokeWidth={1.5} />
          </div>
          <button 
            onClick={handleDelete}
            disabled={isDeleting || isUpdating}
            className="h-10 w-10 text-white/20 hover:text-white hover:bg-white/5 rounded-full flex items-center justify-center transition-all bg-black/20 border border-transparent hover:border-white/10 disabled:opacity-50"
          >
             <Trash2 size={16} />
          </button>
        </div>

        <h3 className="text-2xl font-black font-display tracking-tight text-white mb-2 line-clamp-1 group-hover:text-white transition-colors uppercase italic">{title}</h3>
        <div className="flex items-center gap-2 mb-8">
           <div className="h-2 w-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,1)]" />
           <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Operational</span>
        </div>

        {/* Config Summary */}
        <div className="space-y-4 mb-4 bg-black/30 p-5 rounded-2xl border border-white/5">
           <ConfigRow icon={DollarSign} value={s.priceMin || s.priceMax ? `${formatUsdFromCents(s.priceMin)} - ${formatUsdFromCents(s.priceMax)}` : "All Budgets"} />
           <ConfigRow icon={Calendar} value={s.yearMin || s.yearMax ? `${s.yearMin || "Any"} - ${s.yearMax || "Any"}` : "Any Year"} />
           <ConfigRow icon={MapPin} value={s.city || "All Sectors"} />
           {s.mileageMax && (
             <ConfigRow icon={Gauge} value={`${s.mileageMax.toLocaleString()} MI LIMIT`} />
           )}
        </div>

        {/* Email Row */}
        <div className="mb-8 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between group/email transition-colors hover:bg-white/[0.05]">
           <div className="flex items-center gap-3 overflow-hidden">
              <Mail size={14} className="text-white/40 flex-shrink-0" />
              {isEditing ? (
                <Input 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-7 bg-transparent border-b border-white/20 border-t-0 border-x-0 rounded-none px-0 text-xs font-black text-white focus-visible:ring-0 uppercase"
                  autoFocus
                />
              ) : (
                <span className="text-[10px] font-black text-white/60 truncate uppercase tracking-widest">{s.email}</span>
              )}
           </div>
           
           <div className="flex items-center gap-1">
             {isEditing ? (
               <>
                 <button onClick={handleUpdateEmail} disabled={isUpdating} className="p-1.5 text-white/60 hover:text-white transition-colors">
                    <Check size={14} />
                 </button>
                 <button onClick={() => setIsEditing(false)} className="p-1.5 text-white/20 hover:text-white transition-colors">
                    <X size={14} />
                 </button>
               </>
             ) : (
               <button onClick={() => setIsEditing(true)} className="p-1.5 text-white/10 hover:text-white opacity-0 group-hover/email:opacity-100 transition-all">
                  <Pencil size={14} />
               </button>
             )}
           </div>
        </div>

        {/* Footer Info */}
        <div className="pt-6 border-t border-white/10 flex items-center justify-between">
           <div className="flex items-center gap-2 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
              <Clock size={14} className="text-white/20" />
              Capture: {new Date(s.createdAt).toLocaleDateString()}
           </div>
           <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/40 border border-white/10 shadow-2xl hover:scale-110 transition-transform">
              <Zap size={14} className="animate-pulse" />
           </div>
        </div>
      </div>
    </article>
  );
}
