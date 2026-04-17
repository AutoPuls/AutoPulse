"use client";

import * as React from "react";
import { SearchFiltersSync } from "@/components/SearchFiltersSync";
import { CityPills } from "@/components/CityPills";
import { SearchAlertBanner } from "@/components/SearchAlertBanner";
import { FilterSidebar } from "@/components/FilterSidebar";
import { MobileFilters } from "@/components/MobileFilters";
import { SearchSort } from "@/components/SearchSort";
import { CarFront, LayoutGrid, ListFilter, Activity } from "lucide-react";

export function SearchLayout({
  total,
  sidebarInitial,
  children,
}: {
  total: number;
  sidebarInitial: any;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="min-h-screen bg-cyber-mesh dark:bg-cyber-mesh pt-20 pb-20 sm:pt-32">
      <SearchFiltersSync />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Superior Dashboard Header */}
        <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/40 p-5 backdrop-blur-3xl shadow-glass-surface sm:mb-12 sm:rounded-[3rem] sm:p-8 lg:p-12">
           <div className="absolute top-0 right-0 -mr-10 -mt-10 h-64 w-64 rounded-full bg-primary/5 blur-[80px]" />
           
           <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative z-10 max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                   <Activity size={12} className="animate-pulse" />
                   Real-time Indexing Active
                </div>
                <h1 className="font-display text-3xl font-black leading-[1.1] tracking-tighter text-foreground sm:text-6xl">
                  Discover Your <br />
                  <span className="text-gradient">Dream Machine</span>
                </h1>
                <p className="mt-6 text-lg font-medium text-muted-foreground max-w-lg">
                   Explore <span className="text-foreground font-bold">{total.toLocaleString()}</span> listings curated from across the United States. Advanced filters enabled.
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4">
                 <div className="flex items-center rounded-2xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/5">
                    <SearchSort />
                 </div>
                 <div className="lg:hidden">
                    <MobileFilters initial={sidebarInitial} />
                 </div>
              </div>
           </div>
        </div>

        {/* Global Components */}
        <div className="mb-10 flex flex-col gap-4">
          <CityPills />
          <SearchAlertBanner />
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          
          {/* Sidebar Area */}
          <aside className="hidden lg:block w-80 sticky top-32">
             <div className="rounded-[2.5rem] border border-black/5 dark:border-white/5 bg-white/30 dark:bg-black/30 p-8 backdrop-blur-2xl shadow-xl">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/10 dark:border-white/10">
                   <h2 className="flex items-center gap-2 text-xl font-black tracking-tighter text-foreground dark:text-white">
                      <ListFilter size={20} className="text-primary" />
                      FILTERS
                   </h2>
                </div>
                <FilterSidebar initial={sidebarInitial} />
             </div>
             
             {/* Secondary Sidebar Widget (Promo/Info) */}
             <div className="mt-6 rounded-[2rem] border border-black/5 dark:border-white/5 bg-primary/5 p-6 backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-2">
                   <CarFront size={18} className="text-primary" />
                   <h4 className="text-xs font-black uppercase tracking-widest text-foreground dark:text-white">Pro Tip</h4>
                </div>
                <p className="text-[11px] font-bold leading-relaxed text-muted-foreground uppercase tracking-wider">
                   Combine &apos;Trim&apos; and &apos;Keywords&apos; (like AWD) for the most accurate results.
                </p>
             </div>
          </aside>

          {/* Results Grid Area */}
          <div className="min-w-0 flex-1">
             <div className="flex items-center gap-3 mb-8">
                <LayoutGrid size={18} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Inventory Feed</h3>
                <div className="h-px flex-1 bg-black/5 dark:bg-white/5" />
             </div>
             {children}
          </div>

        </div>
      </div>
    </div>
  );
}
