import type { ReactElement } from "react";
import { 
  Bell, 
  Trash2, 
  Mail,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubscriptionCard } from "@/components/SubscriptionCard";

export const dynamic = "force-dynamic";

export default async function AlertsPage(): Promise<ReactElement> {
  const { prisma } = await import("@/lib/db");
  let subscriptions: any[] = [];

  try {
    subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("[alerts/page]", e);
  }

  return (
    <div className="min-h-screen bg-cyber-mesh pt-36 pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Header Area */}
        <div className="mb-16 text-center lg:text-left lg:flex lg:items-end lg:justify-between gap-10">
           <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyber-blue/30 bg-cyber-blue/10 px-4 py-1.5 text-sm font-bold text-cyber-blue shadow-[0_0_15px_rgba(0,216,255,0.2)]">
                 <Bell size={16} /> Sentinel Command Center
              </div>
              <h1 className="font-display text-5xl font-black tracking-tighter text-white sm:text-7xl">
                 Active <span className="bg-gradient-to-r from-white via-cyan-200 to-cyber-blue bg-clip-text text-transparent">Sentinels</span>
              </h1>
              <p className="mt-6 text-lg font-medium text-gray-400">
                 Manage your automated search alerts. Our crawlers monitor Facebook Marketplace 24/7 and will email you the moment a match hitting your criteria enters the system.
              </p>
           </div>
           
           <div className="hidden lg:block">
              <div className="rounded-[2rem] border border-white/10 bg-black/60 p-8 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,216,255,0.1)]">
                 <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/20">
                       <Zap size={24} className="animate-pulse" />
                    </div>
                    <div>
                       <div className="text-xl font-black text-white tracking-widest">{subscriptions.length} <span className="text-cyber-blue">ALERTS</span></div>
                       <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Live DB Connection Active</div>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Alerts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptions.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 rounded-[2.5rem] border border-dashed border-white/10 p-20 text-center bg-black/40 backdrop-blur-3xl shadow-inner">
               <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/[0.02] border border-white/5 text-gray-600">
                  <Bell size={40} />
               </div>
               <h3 className="text-3xl font-display font-black text-white tracking-tight mb-2">No Active Sentinels</h3>
               <p className="text-gray-500 mb-8 max-w-xs mx-auto">Set your first alert from the search page to start monitoring national inventory.</p>
               <Button asChild className="rounded-full px-10 py-6 font-black bg-white/5 border border-white/10 hover:bg-white/10">
                  <a href="/search">Go to Search</a>
               </Button>
            </div>
          ) : (
            subscriptions.map((s) => (
              <SubscriptionCard key={s.id} subscription={s} />
            ))
          )}
        </div>

      </div>
    </div>
  );
}
