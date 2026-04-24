"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  MapPin, 
  Zap,
  Palette,
  DollarSign
} from "lucide-react";
import { SearchFilterValues } from "./SearchFiltersContext";
import { cn } from "@/lib/utils";

type Props = {
  initial: SearchFilterValues;
  onApply?: () => void;
};

export function FilterFields({ initial, onApply }: Props): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);
  
  const [keywords, setKeywords] = useState(initial.keywords || "");
  const [make, setMake] = useState(initial.make || "");
  const [model, setModel] = useState(initial.model || "");
  const [yearMin, setYearMin] = useState(initial.yearMin || "");
  const [yearMax, setYearMax] = useState(initial.yearMax || "");
  const [priceMin, setPriceMin] = useState(initial.priceMin || "");
  const [priceMax, setPriceMax] = useState(initial.priceMax || "");
  const [mileageMax, setMileageMax] = useState(initial.mileageMax || "");
  const [city, setCity] = useState(initial.city || "");
  const [transmission, setTransmission] = useState(initial.transmission || "");
  const [fuelType, setFuelType] = useState(initial.fuelType || "");
  const [driveType, setDriveType] = useState(initial.driveType || "");
  const [titleStatus, setTitleStatus] = useState(initial.titleStatus || "");
  const [color, setColor] = useState(initial.color || "");
  const [bodyStyle, setBodyStyle] = useState(initial.bodyStyle || "");

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (k: string, v: string): void => {
      if (v) params.set(k, v);
      else params.delete(k);
    };
    
    setOrDelete("keywords", keywords);
    setOrDelete("make", make);
    setOrDelete("model", model);
    setOrDelete("yearMin", yearMin);
    setOrDelete("yearMax", yearMax);
    setOrDelete("priceMin", priceMin);
    setOrDelete("priceMax", priceMax);
    setOrDelete("mileageMax", mileageMax);
    setOrDelete("city", city);
    setOrDelete("transmission", transmission);
    setOrDelete("fuelType", fuelType);
    setOrDelete("driveType", driveType);
    setOrDelete("titleStatus", titleStatus);
    setOrDelete("color", color);
    setOrDelete("bodyStyle", bodyStyle);

    params.delete("page");
    const q = params.toString();
    router.push(q ? `/search?${q}` : "/search", { scroll: false });
    if (onApply) onApply();
  }, [
    keywords, make, model, yearMin, yearMax, priceMin, priceMax, mileageMax, city,
    transmission, fuelType, driveType, titleStatus, color, bodyStyle,
    router, searchParams, onApply
  ]);

  useEffect(() => {
    if (firstRender.current) {
        firstRender.current = false;
        return;
    }
    const timer = setTimeout(() => apply(), 500);
    return () => clearTimeout(timer);
  }, [
    keywords, make, model, yearMin, yearMax, priceMin, priceMax, mileageMax, city,
    transmission, fuelType, driveType, titleStatus, color, bodyStyle, apply
  ]);

  const resetAll = () => {
    router.push("/search");
  };

  return (
    <div className="flex flex-col gap-10">
      
      {/* SECTION: IDENTITY */}
      <section className="space-y-6">
        <SectionHeader icon={Search} label="Identity" />
        <div className="space-y-4">
           <div className="relative group">
             <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
             <input
               value={keywords}
               onChange={(e) => setKeywords(e.target.value)}
               placeholder="SEARCH KEYWORDS..."
               className="w-full h-12 bg-white/[0.03] border border-white/5 rounded-2xl pl-12 pr-4 text-[11px] font-black uppercase tracking-widest text-white placeholder:text-white/10 outline-none focus:border-primary/40 focus:bg-white/5 transition-all text-center sm:text-left"
             />
           </div>
           
           <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                 <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Make</Label>
                 <input
                   value={make}
                   onChange={(e) => setMake(e.target.value)}
                   className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-all"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Model</Label>
                 <input
                   value={model}
                   onChange={(e) => setModel(e.target.value)}
                   className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-all"
                 />
              </div>
           </div>
        </div>
      </section>

      {/* SECTION: PERFORMANCE */}
      <section className="space-y-6">
        <SectionHeader icon={Zap} label="Performance" />
        <div className="space-y-6">
           <FilterGroup label="Drivetrain">
              {["AWD", "4WD", "FWD", "RWD"].map(d => (
                 <Pill key={d} label={d} active={driveType === d} onClick={() => setDriveType(driveType === d ? "" : d)} />
              ))}
           </FilterGroup>

           <FilterGroup label="Transmission">
              {["Automatic", "Manual"].map(t => (
                 <Pill key={t} label={t} active={transmission === t.toLowerCase()} onClick={() => setTransmission(transmission === t.toLowerCase() ? "" : t.toLowerCase())} />
              ))}
           </FilterGroup>

           <FilterGroup label="Energy">
              {["Gasoline", "Hybrid", "Electric"].map(f => (
                 <Pill key={f} label={f} active={fuelType === f.toLowerCase()} onClick={() => setFuelType(fuelType === f.toLowerCase() ? "" : f.toLowerCase())} />
              ))}
           </FilterGroup>
        </div>
      </section>

      {/* SECTION: BUDGET & ANALYTICS */}
      <section className="space-y-6">
        <SectionHeader icon={DollarSign} label="Financials" />
        <div className="space-y-6">
           <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5">
              <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 block mb-4">Price Threshold (USD)</Label>
              <div className="flex items-center gap-3">
                 <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 font-black text-[10px]">$</span>
                    <input
                      type="number"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="MIN"
                      className="w-full h-10 bg-black/40 border border-white/5 rounded-xl pl-7 pr-3 text-[10px] font-black tracking-widest text-white outline-none focus:border-primary/40"
                    />
                 </div>
                 <div className="h-px w-3 bg-white/10" />
                 <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 font-black text-[10px]">$</span>
                    <input
                      type="number"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="MAX"
                      className="w-full h-10 bg-black/40 border border-white/5 rounded-xl pl-7 pr-3 text-[10px] font-black tracking-widest text-white outline-none focus:border-primary/40"
                    />
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                 <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Max Mileage</Label>
                 <input
                   value={mileageMax}
                   onChange={(e) => setMileageMax(e.target.value)}
                   placeholder="100K"
                   className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-all"
                 />
              </div>
              <div className="flex flex-col gap-2">
                 <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Production Year</Label>
                 <input
                   type="number"
                   value={yearMin}
                   onChange={(e) => setYearMin(e.target.value)}
                   placeholder="2018"
                   className="w-full h-10 bg-white/[0.03] border border-white/5 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-all"
                 />
              </div>
           </div>
        </div>
      </section>

      {/* SECTION: BODY & LOCATION */}
      <section className="space-y-6">
        <SectionHeader icon={Palette} label="Body & Sector" />
        <div className="space-y-6">
           <FilterGroup label="Configuration">
              {["SUV", "Truck", "Sedan", "Coupe"].map(b => (
                 <Pill key={b} label={b} active={bodyStyle === b.toLowerCase()} onClick={() => setBodyStyle(bodyStyle === b.toLowerCase() ? "" : b.toLowerCase())} />
              ))}
           </FilterGroup>

           <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Operation Sector</Label>
              <div className="relative group">
                 <MapPin size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary" />
                 <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="LOCATE CITY..."
                    className="w-full h-11 bg-white/[0.02] border border-white/5 rounded-xl pl-10 pr-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-all text-center sm:text-left"
                 />
              </div>
           </div>
        </div>
      </section>

      <div className="pt-10 flex flex-col gap-3">
         <button 
           onClick={resetAll}
           className="w-full h-12 rounded-2xl bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all active:scale-[0.98]"
         >
            SYNC PARAMETERS
         </button>
         <button 
           onClick={() => router.push("/search")}
           className="w-full h-10 text-[9px] font-black uppercase tracking-[0.3em] text-white/20 hover:text-white transition-colors"
         >
            Nuke All Filters
         </button>
      </div>

    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex items-center gap-4">
       <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 border border-white/5 text-primary">
          <Icon size={14} />
       </div>
       <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white">{label}</h3>
       <div className="h-px flex-1 bg-white/[0.05]" />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-3">
       <Label className="text-[8px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{label}</Label>
       <div className="flex flex-wrap gap-1.5">
          {children}
       </div>
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
        active 
          ? "bg-primary border-primary text-black" 
          : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white hover:border-white/20"
      )}
    >
      {label}
    </button>
  );
}
