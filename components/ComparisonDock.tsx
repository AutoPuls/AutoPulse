"use client";

import React, { useState } from "react";
import { useComparison } from "@/context/ComparisonContext";
import { X, ArrowRightLeft, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { ComparisonOverlay } from "./ComparisonOverlay";
import { cn } from "@/lib/utils";

export function ComparisonDock() {
  const { comparisonList, removeFromComparison, clearComparison } = useComparison();
  const [isOpen, setIsOpen] = useState(false);

  if (comparisonList.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 z-[100] w-full max-w-2xl -translate-x-1/2 px-4 animate-in fade-in slide-in-from-bottom-5 duration-500">
        <div className="flex items-center gap-4 rounded-3xl bg-background border border-border p-2 pl-5 shadow-modal backdrop-blur-xl">
          
          <div className="flex -space-x-3 overflow-hidden py-1">
            {comparisonList.map((item) => (
              <div 
                key={item.id} 
                className="group relative h-11 w-11 shrink-0 rounded-full border-2 border-background bg-surface overflow-hidden cursor-pointer"
                onClick={() => removeFromComparison(item.id)}
              >
                <img 
                  src={item.imageUrls?.[0] || item.imageUrl} 
                  alt={item.make} 
                  className="h-full w-full object-cover transition-transform group-hover:scale-110" 
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <X size={14} className="text-foreground" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 hidden sm:block">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1">
              Comparison Engine
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {comparisonList.length} Units
              </span>
              <span className="h-1 w-1 rounded-full bg-primary animate-pulse-dot" />
            </div>
          </div>

          <div className="flex items-center gap-1 pr-1">
            <button 
              onClick={clearComparison}
              className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Clear all"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={() => setIsOpen(true)}
              className="h-10 px-5 rounded-2xl bg-primary text-white text-xs font-semibold shadow-blue hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2"
            >
              Compare <ArrowRightLeft size={14} />
            </button>
          </div>
        </div>
      </div>

      <ComparisonOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
