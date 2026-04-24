"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { useSearchFilters } from "@/components/SearchFiltersContext";

export function SearchAlertBanner(): React.ReactElement {
  const { setAlertOpen } = useSearchFilters();

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Subtle blue top accent line */}
      <div className="h-0.5 w-full bg-primary" />

      <div className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">
            Intelligence Protocol
          </p>
        </div>

        <p className="text-sm font-semibold text-foreground mb-1.5">
          Active Nationwide Monitoring
        </p>

        <p className="text-xs text-muted-foreground leading-relaxed mb-5">
          Save this configuration to receive real-time uplink transmissions when matching units enter the grid.
        </p>

        <button
          type="button"
          onClick={() => setAlertOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-white text-sm font-semibold shadow-blue hover:bg-primary/90 active:scale-95 transition-all"
        >
          <Bell size={15} />
          Set Alert
        </button>
      </div>
    </div>
  );
}
