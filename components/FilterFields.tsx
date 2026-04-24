"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, useRef } from "react";
import { Search, MapPin, ChevronDown } from "lucide-react";
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
  const [bodyStyle, setBodyStyle] = useState(initial.bodyStyle || "");

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (k: string, v: string) => { if (v) params.set(k, v); else params.delete(k); };
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
    setOrDelete("bodyStyle", bodyStyle);
    params.delete("page");
    const q = params.toString();
    router.push(q ? `/search?${q}` : "/search", { scroll: false });
    if (onApply) onApply();
  }, [keywords, make, model, yearMin, yearMax, priceMin, priceMax, mileageMax, city, transmission, fuelType, driveType, titleStatus, bodyStyle, router, searchParams, onApply]);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const timer = setTimeout(() => apply(), 600);
    return () => clearTimeout(timer);
  }, [keywords, make, model, yearMin, yearMax, priceMin, priceMax, mileageMax, city, transmission, fuelType, driveType, titleStatus, bodyStyle]);

  return (
    <div className="flex flex-col gap-6">

      {/* Keywords */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Search</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keywords}
            onChange={e => setKeywords(e.target.value)}
            placeholder="Keywords..."
            className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:border-primary/50 focus:outline-none transition-colors placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      {/* Make / Model */}
      <FilterSection label="Vehicle">
        <div className="grid grid-cols-2 gap-2">
          <InputField label="Make" value={make} onChange={setMake} placeholder="Any" />
          <InputField label="Model" value={model} onChange={setModel} placeholder="Any" />
        </div>
      </FilterSection>

      {/* Price */}
      <FilterSection label="Price">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <input
              type="number"
              value={priceMin}
              onChange={e => setPriceMin(e.target.value)}
              placeholder="Min"
              className="w-full h-10 pl-6 pr-3 text-sm bg-background border border-border rounded-lg focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
          <div className="text-muted-foreground text-sm">—</div>
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <input
              type="number"
              value={priceMax}
              onChange={e => setPriceMax(e.target.value)}
              placeholder="Max"
              className="w-full h-10 pl-6 pr-3 text-sm bg-background border border-border rounded-lg focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
        </div>
      </FilterSection>

      {/* Year & Mileage */}
      <FilterSection label="Year & Mileage">
        <div className="grid grid-cols-2 gap-2">
          <InputField label="From year" value={yearMin} onChange={setYearMin} placeholder="2015" type="number" />
          <InputField label="Max mileage" value={mileageMax} onChange={setMileageMax} placeholder="100k" />
        </div>
      </FilterSection>

      {/* Drivetrain */}
      <FilterSection label="Drivetrain">
        <div className="flex flex-wrap gap-2">
          {["AWD", "4WD", "FWD", "RWD"].map(d => (
            <Chip key={d} active={driveType === d} onClick={() => setDriveType(driveType === d ? "" : d)}>{d}</Chip>
          ))}
        </div>
      </FilterSection>

      {/* Transmission */}
      <FilterSection label="Transmission">
        <div className="flex gap-2">
          {["Automatic", "Manual"].map(t => (
            <Chip key={t} active={transmission === t.toLowerCase()} onClick={() => setTransmission(transmission === t.toLowerCase() ? "" : t.toLowerCase())}>{t}</Chip>
          ))}
        </div>
      </FilterSection>

      {/* Fuel */}
      <FilterSection label="Fuel type">
        <div className="flex flex-wrap gap-2">
          {["Gasoline", "Hybrid", "Electric"].map(f => (
            <Chip key={f} active={fuelType === f.toLowerCase()} onClick={() => setFuelType(fuelType === f.toLowerCase() ? "" : f.toLowerCase())}>{f}</Chip>
          ))}
        </div>
      </FilterSection>

      {/* Body style */}
      <FilterSection label="Body style">
        <div className="flex flex-wrap gap-2">
          {["SUV", "Truck", "Sedan", "Coupe"].map(b => (
            <Chip key={b} active={bodyStyle === b.toLowerCase()} onClick={() => setBodyStyle(bodyStyle === b.toLowerCase() ? "" : b.toLowerCase())}>{b}</Chip>
          ))}
        </div>
      </FilterSection>

      {/* Location */}
      <FilterSection label="Location">
        <div className="relative">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="City or state..."
            className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:border-primary/50 focus:outline-none transition-colors placeholder:text-muted-foreground/50"
          />
        </div>
      </FilterSection>

      {/* Reset */}
      <button
        onClick={() => router.push("/search")}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
      >
        Clear all filters
      </button>
    </div>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full mb-2.5 group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
          {label}
        </span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && children}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:border-primary/50 focus:outline-none transition-colors placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
        active
          ? "bg-primary text-white border-primary shadow-blue"
          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}
