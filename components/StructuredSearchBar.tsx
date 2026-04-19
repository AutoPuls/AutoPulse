"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, MapPin, Car, BookOpen, ChevronDown, X, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAKES, MODEL_MAP } from "@/lib/constants";
import { MARKETPLACE_CITIES } from "@/lib/cities";
import { SmartSearchBar } from "./SmartSearchBar";

export function StructuredSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [mode, setMode] = useState<"structured" | "smart">("structured");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [city, setCity] = useState("");
  
  const [makeOpen, setMakeOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [modelSuggestionsOpen, setModelSuggestionsOpen] = useState(false);
  
  const makeRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Filtered lists
  const filteredMakes = useMemo(() => {
    const q = make.toLowerCase();
    return MAKES.filter(m => m.toLowerCase().includes(q)).sort();
  }, [make]);

  const filteredCities = useMemo(() => {
    const q = city.toLowerCase();
    return MARKETPLACE_CITIES.filter(c => 
      c.label.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    );
  }, [city]);

  const rawModels = useMemo(() => {
    if (!make) return [];
    // Find matching key in MODEL_MAP (case-insensitive)
    const key = Object.keys(MODEL_MAP).find(k => k.toLowerCase() === make.toLowerCase());
    return key ? MODEL_MAP[key] : [];
  }, [make]);

  const filteredModels = useMemo(() => {
    const q = model.toLowerCase();
    return rawModels.filter(m => m.toLowerCase().includes(q)).sort();
  }, [model, rawModels]);

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (makeRef.current && !makeRef.current.contains(e.target as Node)) setMakeOpen(false);
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (make) params.set("make", make);
    if (model) params.set("model", model);
    if (city) {
        // Find city slug if it matches a label perfectly
        const found = MARKETPLACE_CITIES.find(c => c.label.toLowerCase() === city.toLowerCase() || c.slug.toLowerCase() === city.toLowerCase());
        params.set("city", found ? found.slug : city);
    }
    
    router.push(`/search?${params.toString()}`);
  };

  if (mode === "smart") {
    return (
      <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <SmartSearchBar />
        <div className="text-center">
            <button 
                onClick={() => setMode("structured")}
                className="text-xs font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto"
            >
                <Car size={14} />
                Switch to Structured Search
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <form 
        onSubmit={handleSearch}
        className="relative flex flex-col md:flex-row items-stretch gap-0 bg-background/40 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-1 md:p-2 group hover:border-primary/20 transition-all"
      >
        {/* Make Column */}
        <div className="relative flex-1" ref={makeRef}>
            <div className="flex items-center h-full px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-2xl group/item" onClick={() => setMakeOpen(true)}>
                <Car className="mr-3 h-5 w-5 text-primary/60 group-hover/item:text-primary transition-colors" />
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">Make</span>
                    <input 
                        className="bg-transparent border-none outline-none text-foreground font-bold text-lg placeholder:text-muted-foreground/30 w-full"
                        placeholder="Any Make"
                        value={make}
                        onChange={(e) => {
                            setMake(e.target.value);
                            setMakeOpen(true);
                        }}
                        onFocus={() => setMakeOpen(true)}
                    />
                </div>
                {make && (
                    <button onClick={(e) => { e.stopPropagation(); setMake(""); }} className="p-1 hover:bg-white/10 rounded-full">
                        <X size={14} className="text-muted-foreground" />
                    </button>
                )}
                <ChevronDown size={16} className={cn("ml-2 text-muted-foreground transition-transform duration-300", makeOpen && "rotate-180")} />
            </div>

            {makeOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                        {filteredMakes.length > 0 ? (
                            filteredMakes.map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all font-bold text-sm capitalize"
                                    onClick={() => {
                                        setMake(m);
                                        setMakeOpen(false);
                                    }}
                                >
                                    {m}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No results for &quot;{make}&quot;</div>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="hidden md:block w-px bg-white/5 my-4" />

        {/* Model Column */}
        <div className="relative flex-1" ref={modelRef}>
            <div className="flex items-center h-full px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-2xl group/item">
                <BookOpen className="mr-3 h-5 w-5 text-primary/60 group-hover/item:text-primary transition-colors" />
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">Model</span>
                    <input 
                        className="bg-transparent border-none outline-none text-foreground font-bold text-lg placeholder:text-muted-foreground/30 w-full"
                        placeholder={make ? "Any Model" : "Select Make first"}
                        value={model}
                        onChange={(e) => {
                            setModel(e.target.value);
                            setModelSuggestionsOpen(true);
                        }}
                        onFocus={() => setModelSuggestionsOpen(true)}
                    />
                </div>
                {model && (
                    <button onClick={() => setModel("")} className="p-1 hover:bg-white/10 rounded-full">
                        <X size={14} className="text-muted-foreground" />
                    </button>
                )}
            </div>

            {modelSuggestionsOpen && make && filteredModels.length > 0 && (
                 <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                        <div className="px-4 py-2 text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/5 rounded-lg mb-2">Common {make} Models</div>
                        {filteredModels.map(m => (
                            <button
                                key={m}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all font-bold text-sm capitalize"
                                onClick={() => {
                                    setModel(m);
                                    setModelSuggestionsOpen(false);
                                }}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                 </div>
            )}
        </div>

        <div className="hidden md:block w-px bg-white/5 my-4" />

        {/* City Column */}
        <div className="relative flex-1" ref={cityRef}>
            <div className="flex items-center h-full px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-2xl group/item" onClick={() => setCityOpen(true)}>
                <MapPin className="mr-3 h-5 w-5 text-primary/60 group-hover/item:text-primary transition-colors" />
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">Location</span>
                    <input 
                        className="bg-transparent border-none outline-none text-foreground font-bold text-lg placeholder:text-muted-foreground/30 w-full"
                        placeholder="Nationwide"
                        value={city}
                        onChange={(e) => {
                            setCity(e.target.value);
                            setCityOpen(true);
                        }}
                        onFocus={() => setCityOpen(true)}
                    />
                </div>
                {city && (
                    <button onClick={(e) => { e.stopPropagation(); setCity(""); }} className="p-1 hover:bg-white/10 rounded-full">
                        <X size={14} className="text-muted-foreground" />
                    </button>
                )}
                <ChevronDown size={16} className={cn("ml-2 text-muted-foreground transition-transform duration-300", cityOpen && "rotate-180")} />
            </div>

            {cityOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-card border border-white/10 rounded-2xl shadow-2xl max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                        {filteredCities.length > 0 ? (
                            filteredCities.map(c => (
                                <button
                                    key={c.slug}
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-primary/10 rounded-xl transition-all font-bold text-sm"
                                    onClick={() => {
                                        setCity(c.label);
                                        setCityOpen(false);
                                    }}
                                >
                                    {c.label}
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No cities found for &quot;{city}&quot;</div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Search Button */}
        <div className="p-2">
            <Button 
                type="submit"
                className="w-full md:w-auto h-full px-8 py-6 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(0,216,255,0.4)] hover:shadow-[0_0_40px_rgba(0,216,255,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group/btn"
            >
                <Search className="h-5 w-5 group-hover/btn:scale-110 transition-transform" />
                <span>Search</span>
            </Button>
        </div>
      </form>

      <div className="text-center">
            <button 
                onClick={() => setMode("smart")}
                className="text-xs font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto decoration-primary/30 underline-offset-4 hover:underline"
            >
                <Sparkles size={14} className="animate-pulse" />
                Switch to Smart NLP Search
            </button>
        </div>
    </div>
  );
}
