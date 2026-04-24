"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useSearchFilters } from "@/components/SearchFiltersContext";

export function SearchAlertBanner(): React.ReactElement {
  const { setAlertOpen } = useSearchFilters();

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/5 bg-white/[0.02] p-8 backdrop-blur-3xl shadow-2xl sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 mb-1">Intelligence Protocol</p>
        <p className="text-xl font-black text-white italic uppercase tracking-tight">Active Nationwide Monitoring</p>
        <p className="text-[11px] font-medium text-white/30 tracking-widest mt-2 uppercase max-w-sm">
          Save this configuration to receive real-time uplink transmissions when matching units enter the grid.
        </p>
      </div>
      <Button
        type="button"
        className="shrink-0 h-12 px-8 rounded-xl bg-white text-black font-black uppercase tracking-widest hover:bg-white active:scale-95 transition-all shadow-xl"
        onClick={() => setAlertOpen(true)}
      >
        Set Alert
      </Button>
    </div>
  );
}
