"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Car, 
  Calendar, 
  DollarSign, 
  Gauge, 
  MapPin, 
  Zap,
  ShieldCheck,
  Palette,
  Eye
} from "lucide-react";
import { SearchFilterValues } from "./SearchFiltersContext";

type Props = {
  initial: SearchFilterValues;
  onApply?: () => void;
};

export function FilterFields({ initial, onApply }: Props): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const firstRender = useRef(true);
  
  // Grouped States
  const [keywords, setKeywords] = useState(initial.keywords || "");
  const [make, setMake] = useState(initial.make || "");
  const [model, setModel] = useState(initial.model || "");
  const [yearMin, setYearMin] = useState(initial.yearMin || "");
  const [yearMax, setYearMax] = useState(initial.yearMax || "");
  const [priceMin, setPriceMin] = useState(initial.priceMin || "");
  const [priceMax, setPriceMax] = useState(initial.priceMax || "");
  const [mileageMax, setMileageMax] = useState(initial.mileageMax || "");
  const [city, setCity] = useState(initial.city || "");
  
  // NEW Metadata States
  const [transmission, setTransmission] = useState(initial.transmission || "");
  const [fuelType, setFuelType] = useState(initial.fuelType || "");
  const [driveType, setDriveType] = useState(initial.driveType || "");
  const [titleStatus, setTitleStatus] = useState(initial.titleStatus || "");
  const [color, setColor] = useState(initial.color || "");
  const [bodyStyle, setBodyStyle] = useState(initial.bodyStyle || "");

  // Accordion States
  const [expanded, setExpanded] = useState({
    identity: true,
    performance: false,
    budget: false,
    visuals: false
  });
  
  const toggleSection = (sec: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

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

  // Sync with external URL changes (e.g., clicking City Pills)
  useEffect(() => {
    setKeywords(initial.keywords || "");
    setMake(initial.make || "");
    setModel(initial.model || "");
    setYearMin(initial.yearMin || "");
    setYearMax(initial.yearMax || "");
    setPriceMin(initial.priceMin || "");
    setPriceMax(initial.priceMax || "");
    setMileageMax(initial.mileageMax || "");
    setCity(initial.city || "");
    setTransmission(initial.transmission || "");
    setFuelType(initial.fuelType || "");
    setDriveType(initial.driveType || "");
    setTitleStatus(initial.titleStatus || "");
    setColor(initial.color || "");
    setBodyStyle(initial.bodyStyle || "");
  }, [
    initial.keywords, initial.make, initial.model, initial.yearMin, initial.yearMax, 
    initial.priceMin, initial.priceMax, initial.mileageMax, initial.city, 
    initial.transmission, initial.fuelType, initial.driveType, initial.titleStatus, 
    initial.color, initial.bodyStyle
  ]);

  // REAL-TIME DEBOUNCE (400ms)
  useEffect(() => {
    if (firstRender.current) {
        firstRender.current = false;
        return;
    }
    const timer = setTimeout(() => {
      apply();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    keywords, make, model, yearMin, yearMax, priceMin, priceMax, mileageMax, city,
    transmission, fuelType, driveType, titleStatus, color, bodyStyle
  ]);

  return (
    <div className="flex flex-col h-full gap-4">
      
      {/* 1. ESSENTIALS SECTION */}
      <div className="rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/5 overflow-hidden">
        <SectionHeader 
           icon={Search} 
           title="Vehicle Identity" 
           isOpen={expanded.identity} 
           onClick={() => toggleSection('identity')} 
        />
        {expanded.identity && (
        <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-cyber-blue transition-colors" />
            <Input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="AWD, Turbo, Leather..."
              className="glass-input h-11 pl-11 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Make</Label>
                <Input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                  className="glass-input h-10 px-3 rounded-lg text-sm"
                />
             </div>
             <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Model</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Camry"
                  className="glass-input h-10 px-3 rounded-lg text-sm"
                />
             </div>
          </div>

          {/* Quick Makes */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Toyota", "Chevrolet", "Ford", "Honda", "Jeep", "BMW"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMake(make === m ? "" : m)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-widest transition-all border ${
                  make === m 
                  ? "bg-cyber-blue text-black border-cyber-blue shadow-[0_0_10px_rgba(0,216,255,0.4)]" 
                  : "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/5 hover:border-cyber-blue/50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {/* 2. PERFORMANCE SECTION */}
      <div className="rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/5 overflow-hidden">
        <SectionHeader 
           icon={Zap} 
           title="Power & Performance" 
           isOpen={expanded.performance} 
           onClick={() => toggleSection('performance')} 
        />
        {expanded.performance && (
        <div className="p-5 pt-0 space-y-5 animate-in slide-in-from-top-2 duration-300">
           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Transmission</Label>
              <div className="flex gap-2">
                 {["Automatic", "Manual"].map(t => (
                    <ToggleButton 
                      key={t} 
                      label={t} 
                      active={transmission === t.toLowerCase()} 
                      onClick={() => setTransmission(transmission === t.toLowerCase() ? "" : t.toLowerCase())} 
                    />
                 ))}
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fuel System</Label>
              <div className="flex flex-wrap gap-2">
                 {["Gasoline", "Hybrid", "Electric", "Diesel"].map(f => (
                    <ToggleButton 
                      key={f} 
                      label={f} 
                      active={fuelType === f.toLowerCase()} 
                      onClick={() => setFuelType(fuelType === f.toLowerCase() ? "" : f.toLowerCase())} 
                    />
                 ))}
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Drive Type</Label>
              <div className="flex flex-wrap gap-2">
                 {["AWD", "4WD", "FWD", "RWD"].map(d => (
                    <ToggleButton 
                      key={d} 
                      label={d} 
                      active={driveType === d} 
                      onClick={() => setDriveType(driveType === d ? "" : d)} 
                    />
                 ))}
              </div>
           </div>
        </div>
        )}
      </div>

      {/* 3. BUDGET & HISTORY */}
      <div className="rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/5 overflow-hidden">
        <SectionHeader 
           icon={DollarSign} 
           title="Budget & Condition" 
           isOpen={expanded.budget} 
           onClick={() => toggleSection('budget')} 
        />
        {expanded.budget && (
        
        <div className="p-5 pt-0 space-y-5 animate-in slide-in-from-top-2 duration-300">
           {/* Faux Range Slider for Price */}
           <div className="space-y-2">
             <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 block">Price Range</Label>
             <div className="flex items-center gap-1 rounded-xl bg-black/5 dark:bg-black/40 border border-black/10 dark:border-white/10 p-1">
                <div className="relative flex-1">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cyber-blue">$</span>
                   <Input
                     type="number"
                     value={priceMin}
                     onChange={(e) => setPriceMin(e.target.value)}
                     placeholder="Min"
                     className="h-9 border-0 bg-transparent pl-7 pr-2 text-sm shadow-none focus-visible:ring-0"
                   />
                </div>
                <div className="h-6 w-px bg-black/10 dark:bg-white/10" />
                <div className="relative flex-1">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-cyber-blue">$</span>
                   <Input
                     type="number"
                     value={priceMax}
                     onChange={(e) => setPriceMax(e.target.value)}
                     placeholder="Max"
                     className="h-9 border-0 bg-transparent pl-7 pr-2 text-sm shadow-none focus-visible:ring-0"
                   />
                </div>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Year From</Label>
                 <Input
                    type="number"
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    placeholder="2010"
                    className="glass-input h-10 px-3 rounded-lg text-sm"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Mileage Max</Label>
                 <Input
                    type="number"
                    value={mileageMax}
                    onChange={(e) => setMileageMax(e.target.value)}
                    placeholder="100k"
                    className="glass-input h-10 px-3 rounded-lg text-sm"
                 />
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Title Status</Label>
              <div className="flex gap-2">
                 {["Clean", "Salvage"].map(s => (
                    <ToggleButton 
                      key={s} 
                      label={s} 
                      active={titleStatus === s.toLowerCase()} 
                      onClick={() => setTitleStatus(titleStatus === s.toLowerCase() ? "" : s.toLowerCase())} 
                    />
                 ))}
              </div>
           </div>
        </div>
        )}
      </div>

      {/* 4. AESTHETICS */}
      <div className="rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/5 overflow-hidden">
        <SectionHeader 
           icon={Palette} 
           title="Visuals & Location" 
           isOpen={expanded.visuals} 
           onClick={() => toggleSection('visuals')} 
        />
        {expanded.visuals && (
        
        <div className="p-5 pt-0 space-y-5 animate-in slide-in-from-top-2 duration-300">
           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Exterior Color</Label>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Black, Silver, Red..."
                className="glass-input h-10 px-3 rounded-lg text-sm"
              />
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Body Style</Label>
              <div className="flex flex-wrap gap-2">
                 {["SUV", "Truck", "Sedan", "Coupe", "Van"].map(b => (
                    <ToggleButton 
                      key={b} 
                      label={b} 
                      active={bodyStyle === b.toLowerCase()} 
                      onClick={() => setBodyStyle(bodyStyle === b.toLowerCase() ? "" : b.toLowerCase())} 
                    />
                 ))}
              </div>
           </div>

           <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Search Location</Label>
              <div className="relative">
                 <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                 <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City, State"
                    className="glass-input h-10 pl-9 pr-3 rounded-lg text-sm"
                 />
              </div>
           </div>
        </div>
        )}
      </div>
      
      {/* Real-time Status Indicator or Show Results for Mobile */}
      <div className="pt-6 mt-auto pb-4">
         {onApply ? (
            <button
               type="button"
               onClick={onApply}
               className="w-full py-4 rounded-xl bg-cyber-blue text-sm font-black text-black shadow-[0_0_20px_rgba(0,216,255,0.4)] transition-transform active:scale-[0.98]"
            >
               View Results
            </button>
         ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-black/5 dark:bg-white/[0.02] py-3 border border-dashed border-black/10 dark:border-white/10">
               <div className="h-1.5 w-1.5 rounded-full bg-cyber-blue animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Filters Enabled</span>
            </div>
         )}
      </div>

      {/* 2.5 PREMIUM FEATURES SECTION */}
      <div className="rounded-2xl bg-black/5 dark:bg-white/[0.02] border border-black/10 dark:border-white/5 overflow-hidden">
        <SectionHeader 
           icon={ShieldCheck} 
           title="Premium Features" 
           isOpen={expanded.identity} // Reusing identity expansion or could add a new one
           onClick={() => toggleSection('identity')} 
        />
        <div className="p-5 pt-0 space-y-3">
           <Label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Popular Tags</Label>
           <div className="flex flex-wrap gap-2">
              {[
                "Sunroof", "Leather", "Navigation", "Backup Camera", 
                "Apple Carplay", "Third Row", "Heated Seats", "Tow Package",
                "New Tires", "AWD", "Clean Title"
              ].map(feat => (
                <button
                   key={feat}
                   type="button"
                   onClick={() => {
                     const low = feat.toLowerCase();
                     const currentVal = keywords || "";
                     if (currentVal.toLowerCase().includes(low)) {
                        setKeywords(currentVal.replace(new RegExp(low, 'gi'), "").replace(/,\s*,/g, ",").trim());
                     } else {
                        setKeywords(currentVal ? `${currentVal}, ${feat}` : feat);
                     }
                   }}
                   className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                     keywords.toLowerCase().includes(feat.toLowerCase())
                     ? "bg-cyber-blue text-black border-cyber-blue shadow-[0_0_10px_rgba(0,216,255,0.3)]"
                     : "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/5 hover:border-cyber-blue/50 hover:text-foreground"
                   }`}
                >
                   {feat}
                </button>
              ))}
           </div>
        </div>
      </div>

    </div>
  );
}


function SectionHeader({ icon: Icon, title, isOpen, onClick }: { icon: any, title: string, isOpen?: boolean, onClick?: () => void }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between p-5 transition-colors ${isOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      <div className="flex items-center gap-3">
         <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-cyber-blue/10 ${isOpen ? 'text-cyber-blue shadow-[0_0_15px_rgba(0,216,255,0.2)]' : 'text-gray-500'}`}>
            <Icon size={16} />
         </div>
         <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-display">{title}</h3>
      </div>
      <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyber-blue' : 'text-gray-600'}`}>
         <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
      </div>
    </button>
  );
}

function ToggleButton({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${
                active 
                ? "bg-cyber-blue text-black border-cyber-blue shadow-[0_0_10px_rgba(0,216,255,0.3)]" 
                : "bg-black/5 dark:bg-white/5 text-muted-foreground border-black/10 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20 hover:text-foreground"
            }`}
        >
            {label}
        </button>
    )
}

