"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, MapPin, Car, BookOpen, ChevronDown, X, Sparkles, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
    const key = Object.keys(MODEL_MAP).find(k => k.toLowerCase() === make.toLowerCase());
    return key ? MODEL_MAP[key] : [];
  }, [make]);

  const filteredModels = useMemo(() => {
    const q = model.toLowerCase();
    return rawModels.filter(m => m.toLowerCase().includes(q)).sort();
  }, [model, rawModels]);

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
        const found = MARKETPLACE_CITIES.find(c => c.label.toLowerCase() === city.toLowerCase() || c.slug.toLowerCase() === city.toLowerCase());
        params.set("city", found ? found.slug : city);
    }
    router.push(`/search?${params.toString()}`);
  };

  if (mode === "smart") {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto">
        <SmartSearchBar />
        <button 
            onClick={() => setMode("structured")}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 hover:text-primary transition-all flex items-center justify-center gap-3 mx-auto"
        >
            <Car size={14} />
            Reverse to Manual Entry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <form 
        onSubmit={handleSearch}
        className="relative flex flex-col md:flex-row items-stretch gap-0 bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[2rem] sm:rounded-full overflow-hidden shadow-2xl p-1.5 md:p-2 group hover:border-white/20 transition-all"
      >
        {/* Make Column */}
        <div className="relative flex-1" ref={makeRef}>
            <div className="flex items-center h-full px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-3xl group/item" onClick={() => setMakeOpen(true)}>
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1 group-hover/item:text-primary transition-colors">Manufacturer</span>
                    <input 
                        className="bg-transparent border-none outline-none text-white font-black text-lg placeholder:text-white/10 w-full uppercase tracking-tighter"
                        placeholder="ALL MAKES"
                        value={make}
                        onChange={(e) => {
                            setMake(e.target.value);
                            setMakeOpen(true);
                        }}
                        onFocus={() => setMakeOpen(true)}
                    />
                </div>
                {make && (
                    <button onClick={(e) => { e.stopPropagation(); setMake(""); }} className="p-1 hover:bg-white/10 rounded-full text-white/40">
                        <X size={14} />
                    </button>
                )}
                <ChevronDown size={14} className={cn("ml-2 text-white/20 transition-transform duration-300", makeOpen && "rotate-180")} />
            </div>

            {makeOpen && (
                <div className="absolute top-[calc(100%+12px)] left-0 right-[-200px] z-[100] bg-background/95 backdrop-blur-3xl border border-foreground/10 rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.5)] max-h-[450px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-6 border-b border-foreground/5 bg-foreground/[0.02]">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Select Operational Unit</span>
                    </div>
                    <div className="p-2 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            className="w-full text-left px-5 py-4 hover:bg-foreground/5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground border border-transparent hover:border-foreground/10"
                            onClick={() => {
                                setMake("");
                                setMakeOpen(false);
                            }}
                        >
                            <span className="opacity-40">ALL MANUFACTURERS</span>
                        </button>
                        {filteredMakes.map(m => (
                            <button
                                key={m}
                                type="button"
                                className="w-full text-left px-5 py-4 hover:bg-foreground/5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground border border-transparent hover:border-foreground/10"
                                onClick={() => {
                                    setMake(m);
                                    setMakeOpen(false);
                                }}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="hidden md:block w-px bg-white/10 my-4 h-10 self-center" />

        {/* Model Column */}
        <div className="relative flex-1" ref={modelRef}>
            <div className="flex items-center h-full px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-3xl group/item">
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1 group-hover/item:text-primary transition-colors">Designation</span>
                    <input 
                        className="bg-transparent border-none outline-none text-white font-black text-lg placeholder:text-white/10 w-full uppercase tracking-tighter"
                        placeholder={make ? "ANY MODEL" : "LOCKED"}
                        value={model}
                        onChange={(e) => {
                            setModel(e.target.value);
                            setModelSuggestionsOpen(true);
                        }}
                        onFocus={() => setModelSuggestionsOpen(true)}
                        disabled={!make}
                    />
                </div>
                {model && (
                    <button onClick={() => setModel("")} className="p-1 hover:bg-white/10 rounded-full text-white/40">
                        <X size={14} />
                    </button>
                )}
            </div>

            {modelSuggestionsOpen && make && filteredModels.length > 0 && (
                 <div className="absolute top-[calc(100%+12px)] left-0 right-0 z-50 glass border border-white/10 rounded-3xl shadow-2xl max-h-[350px] overflow-y-auto animate-in fade-in slide-in-from-top-4">
                    <div className="p-2 space-y-1">
                        <div className="px-5 py-3 text-[9px] font-black text-primary uppercase tracking-[0.3em] bg-white/5 rounded-2xl mb-2">Common Varieties</div>
                        {filteredModels.map(m => (
                            <button
                                key={m}
                                type="button"
                                className="w-full text-left px-5 py-3.5 hover:bg-white/5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest text-white/60 hover:text-white"
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

        <div className="hidden md:block w-px bg-white/10 my-4 h-10 self-center" />

        {/* City Column */}
        <div className="relative flex-1" ref={cityRef}>
            <div className="flex items-center h-full px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors rounded-3xl group/item" onClick={() => setCityOpen(true)}>
                <div className="flex flex-col flex-1 truncate">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1 group-hover/item:text-primary transition-colors">Sector</span>
                    <input 
                        className="bg-transparent border-none outline-none text-white font-black text-lg placeholder:text-white/10 w-full uppercase tracking-tighter"
                        placeholder="NATIONWIDE"
                        value={city}
                        onChange={(e) => {
                            setCity(e.target.value);
                            setCityOpen(true);
                        }}
                        onFocus={() => setCityOpen(true)}
                    />
                </div>
                {city && (
                    <button onClick={(e) => { e.stopPropagation(); setCity(""); }} className="p-1 hover:bg-white/10 rounded-full text-white/40">
                        <X size={14} />
                    </button>
                )}
            </div>

            {cityOpen && (
                <div className="absolute top-[calc(100%+12px)] left-[-200px] right-0 z-[100] bg-background/95 backdrop-blur-3xl border border-foreground/10 rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.5)] max-h-[450px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="p-6 border-b border-foreground/5 bg-foreground/[0.02]">
                        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Select Deployment Sector</span>
                    </div>
                    <div className="p-2 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            className="w-full text-left px-5 py-4 hover:bg-foreground/5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground border border-transparent hover:border-foreground/10"
                            onClick={() => {
                                setCity("");
                                setCityOpen(false);
                            }}
                        >
                            <span className="opacity-40">NATIONWIDE</span>
                        </button>
                        {filteredCities.map(c => (
                            <button
                                key={c.slug}
                                type="button"
                                className="w-full text-left px-5 py-4 hover:bg-foreground/5 rounded-2xl transition-all font-black text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground border border-transparent hover:border-foreground/10"
                                onClick={() => {
                                    setCity(c.label);
                                    setCityOpen(false);
                                }}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Search Button */}
        <div className="p-1 md:p-1.5 flex items-center">
            <Button 
                type="submit"
                className="w-full md:w-auto h-16 md:h-full px-10 rounded-full bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] hover:bg-primary transition-all flex items-center justify-center gap-3 active:scale-95 group/btn"
            >
                <Search size={16} className="group-hover/btn:scale-110 transition-transform" />
                <span>EXECUTE</span>
            </Button>
        </div>
      </form>

      <div className="text-center">
            <button 
                onClick={() => setMode("smart")}
                className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-primary transition-all flex items-center justify-center gap-3 mx-auto"
            >
                <Sparkles size={14} className="animate-pulse text-primary" />
                Engage AI Vector Search
            </button>
        </div>
    </div>
  );
}
