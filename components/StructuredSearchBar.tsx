"use client";

import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Search, MapPin, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { MAKES, MODEL_MAP } from "@/lib/constants";
import { MARKETPLACE_CITIES } from "@/lib/cities";

export function StructuredSearchBar() {
  const router = useRouter();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [city, setCity] = useState("");

  // Separate states for the search inputs in the dropdowns
  const [makeQuery, setMakeQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");

  const [makeOpen, setMakeOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const makeRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  const filteredMakes = useMemo(() => {
    const q = makeQuery.toLowerCase();
    return MAKES.filter(m => m.toLowerCase().includes(q)).sort();
  }, [makeQuery]);

  const filteredCities = useMemo(() => {
    const q = cityQuery.toLowerCase();
    return MARKETPLACE_CITIES.filter(c =>
      c.label.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [cityQuery]);

  const rawModels = useMemo(() => {
    if (!make) return [];
    const key = Object.keys(MODEL_MAP).find(k => k.toLowerCase() === make.toLowerCase());
    return key ? MODEL_MAP[key] : [];
  }, [make]);

  const filteredModels = useMemo(() => {
    const q = modelQuery.toLowerCase();
    return rawModels.filter(m => m.toLowerCase().includes(q)).sort();
  }, [modelQuery, rawModels]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;

      // MOBILE LOGIC: Check against the entire form container
      if (window.innerWidth < 640) {
        if (formRef.current && !formRef.current.contains(target)) {
          setMakeOpen(false);
          setCityOpen(false);
          setModelOpen(false);
        }
        return;
      }

      // DESKTOP LOGIC: Check individual refs to allow switching between pills
      if (makeRef.current && !makeRef.current.contains(target)) setMakeOpen(false);
      if (cityRef.current && !cityRef.current.contains(target)) setCityOpen(false);
      if (modelRef.current && !modelRef.current.contains(target)) setModelOpen(false);
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
      const found = MARKETPLACE_CITIES.find(
        c => c.label.toLowerCase() === city.toLowerCase() || c.slug.toLowerCase() === city.toLowerCase()
      );
      params.set("city", found ? found.label : city);
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSearch}
      className="relative w-full"
    >
      {/* Desktop: unified pill bar */}
      <div className="hidden sm:flex items-stretch bg-surface border border-border rounded-2xl shadow-card overflow-visible hover:border-primary/30 transition-colors">

        {/* Make */}
        <div className="relative flex-1 min-w-0" ref={makeRef}>
          <button
            type="button"
            onClick={() => { 
                const newState = !makeOpen;
                setMakeOpen(newState); 
                if (newState) setMakeQuery(""); 
                setCityOpen(false); 
                setModelOpen(false); 
            }}
            className="w-full flex flex-col items-start px-5 py-4 hover:bg-surface-raised transition-colors rounded-l-2xl"
          >
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Make</span>
            <div className="flex items-center gap-2 w-full">
              <span className={cn("text-sm font-medium truncate flex-1 text-left", make ? "text-foreground" : "text-muted-foreground")}>
                {make || "Any make"}
              </span>
              {make
                ? <X size={14} className="text-muted-foreground shrink-0" onClick={e => { e.stopPropagation(); setMake(""); }} />
                : <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", makeOpen && "rotate-180")} />
              }
            </div>
          </button>

          {makeOpen && (
            <DropdownPanel
              onClose={() => setMakeOpen(false)}
              items={filteredMakes}
              emptyLabel="Any make"
              onSelect={v => { setMake(v); setMakeOpen(false); }}
              onClear={() => { setMake(""); setMakeOpen(false); }}
              search={makeQuery}
              onSearch={setMakeQuery}
              searchPlaceholder="Search makes..."
              columns={2}
            />
          )}
        </div>

        <div className="w-px bg-border my-3" />

        {/* Model */}
        <div className="relative flex-1 min-w-0" ref={modelRef}>
          <button
            type="button"
            disabled={!make}
            onClick={() => { 
                const newState = !modelOpen;
                setModelOpen(newState); 
                if (newState) setModelQuery("");
                setMakeOpen(false); 
                setCityOpen(false); 
            }}
            className="w-full flex flex-col items-start px-5 py-4 hover:bg-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Model</span>
            <div className="flex items-center gap-2 w-full">
              <span className={cn("text-sm font-medium truncate flex-1 text-left", model ? "text-foreground" : "text-muted-foreground")}>
                {model || (make ? "Any model" : "Select make first")}
              </span>
              {model
                ? <X size={14} className="text-muted-foreground shrink-0" onClick={e => { e.stopPropagation(); setModel(""); }} />
                : <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", modelOpen && "rotate-180")} />
              }
            </div>
          </button>

          {modelOpen && make && filteredModels.length > 0 && (
            <DropdownPanel
              onClose={() => setModelOpen(false)}
              items={filteredModels}
              emptyLabel="Any model"
              onSelect={v => { setModel(v); setModelOpen(false); }}
              onClear={() => { setModel(""); setModelOpen(false); }}
              search={modelQuery}
              onSearch={setModelQuery}
              searchPlaceholder="Search models..."
              columns={2}
            />
          )}
        </div>

        <div className="w-px bg-border my-3" />

        {/* City */}
        <div className="relative flex-1 min-w-0" ref={cityRef}>
          <button
            type="button"
            onClick={() => { 
                const newState = !cityOpen;
                setCityOpen(newState); 
                if (newState) setCityQuery("");
                setMakeOpen(false); 
                setModelOpen(false); 
            }}
            className="w-full flex flex-col items-start px-5 py-4 hover:bg-surface-raised transition-colors"
          >
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Location</span>
            <div className="flex items-center gap-2 w-full">
              <MapPin size={13} className="text-muted-foreground shrink-0" />
              <span className={cn("text-sm font-medium truncate flex-1 text-left", city ? "text-foreground" : "text-muted-foreground")}>
                {city || "Nationwide"}
              </span>
              {city
                ? <X size={14} className="text-muted-foreground shrink-0" onClick={e => { e.stopPropagation(); setCity(""); }} />
                : <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform", cityOpen && "rotate-180")} />
              }
            </div>
          </button>

          {cityOpen && (
            <DropdownPanel
              onClose={() => setCityOpen(false)}
              items={filteredCities.map(c => c.label)}
              emptyLabel="Nationwide"
              onSelect={v => { setCity(v); setCityOpen(false); }}
              onClear={() => { setCity(""); setCityOpen(false); }}
              search={cityQuery}
              onSearch={setCityQuery}
              searchPlaceholder="Search cities..."
              columns={2}
              alignRight
            />
          )}
        </div>

        {/* Search button */}
        <div className="p-2 flex items-center justify-center">
          <button
            type="submit"
            className="h-12 px-6 rounded-xl bg-primary text-white text-sm font-semibold shadow-blue hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Search size={16} />
            Search
          </button>
        </div>
      </div>

      {/* Mobile: stacked card */}
      <div className="sm:hidden flex flex-col rounded-2xl bg-surface border border-border shadow-card overflow-hidden">
        
        {/* Make row */}
        <MobileField
          label="Make"
          value={make}
          placeholder="Any make"
          onClick={() => { 
              const newState = !makeOpen;
              setMakeOpen(newState); 
              if (newState) setMakeQuery("");
              setCityOpen(false); 
              setModelOpen(false); 
          }}
          onClear={() => setMake("")}
          isOpen={makeOpen}
        />
        {makeOpen && (
          <MobileDropdown
            items={filteredMakes}
            emptyLabel="Any make"
            onSelect={v => { setMake(v); setMakeOpen(false); }}
            onClear={() => { setMake(""); setMakeOpen(false); }}
            onClose={() => setMakeOpen(false)}
            search={makeQuery}
            onSearch={setMakeQuery}
            searchPlaceholder="Search makes..."
          />
        )}

        <div className="h-px bg-border mx-4" />

        {/* Model row */}
        <MobileField
          label="Model"
          value={model}
          placeholder={make ? "Any model" : "Select make first"}
          onClick={() => { 
              if (!make) return; 
              const newState = !modelOpen;
              setModelOpen(newState); 
              if (newState) setModelQuery("");
              setMakeOpen(false); 
              setCityOpen(false); 
          }}
          onClear={() => setModel("")}
          isOpen={modelOpen}
          disabled={!make}
        />
        {modelOpen && make && filteredModels.length > 0 && (
          <MobileDropdown
            items={filteredModels}
            emptyLabel="Any model"
            onSelect={v => { setModel(v); setModelOpen(false); }}
            onClear={() => { setModel(""); setModelOpen(false); }}
            onClose={() => setModelOpen(false)}
            search={modelQuery}
            onSearch={setModelQuery}
            searchPlaceholder="Search models..."
          />
        )}

        <div className="h-px bg-border mx-4" />

        {/* City row */}
        <MobileField
          label="Location"
          value={city}
          placeholder="Nationwide"
          onClick={() => { 
              const newState = !cityOpen;
              setCityOpen(newState); 
              if (newState) setCityQuery("");
              setMakeOpen(false); 
              setModelOpen(false); 
          }}
          onClear={() => setCity("")}
          isOpen={cityOpen}
          icon={<MapPin size={14} className="text-muted-foreground" />}
        />
        {cityOpen && (
          <MobileDropdown
            items={filteredCities.map(c => c.label)}
            emptyLabel="Nationwide"
            onSelect={v => { setCity(v); setCityOpen(false); }}
            onClear={() => { setCity(""); setCityOpen(false); }}
            onClose={() => setCityOpen(false)}
            search={cityQuery}
            onSearch={setCityQuery}
            searchPlaceholder="Search cities..."
          />
        )}

        {/* Search button */}
        <div className="p-3">
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-primary text-white text-sm font-semibold shadow-blue hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Search size={16} />
            Search
          </button>
        </div>
      </div>
    </form>
  );
}

// --- Shared Dropdown Panel (Desktop) ---
function DropdownPanel({
  items,
  emptyLabel,
  onSelect,
  onClear,
  onClose,
  search,
  onSearch,
  searchPlaceholder,
  columns = 1,
  alignRight = false,
}: {
  items: string[];
  emptyLabel: string;
  onSelect: (v: string) => void;
  onClear: () => void;
  onClose: () => void;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
  columns?: number;
  alignRight?: boolean;
}) {
  return (
    <div className={cn(
      "absolute top-[calc(100%+6px)] z-[9999] bg-background border border-border rounded-xl shadow-modal min-w-[280px] max-w-[380px] overflow-hidden animate-in fade-in zoom-in-95 duration-150",
      alignRight ? "right-0" : "left-0"
    )}>
      {/* Search input */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-3 text-sm bg-surface rounded-lg border border-border focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>
      </div>
      {/* Items */}
      <div className={cn(
        "max-h-60 overflow-y-auto p-2",
        columns === 2 && "grid grid-cols-2 gap-1"
      )}>
        <button
          type="button"
          onClick={onClear}
          className="col-span-2 w-full text-left px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg transition-colors"
        >
          {emptyLabel}
        </button>
        {items.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors truncate"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Mobile Field Row ---
function MobileField({ label, value, placeholder, onClick, onClear, isOpen, disabled, icon }: {
  label: string;
  value: string;
  placeholder: string;
  onClick: () => void;
  onClear: () => void;
  isOpen: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 px-4 py-3.5 text-left disabled:opacity-40 hover:bg-surface-raised transition-colors"
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</span>
        <span className={cn("text-sm font-medium truncate", value ? "text-foreground" : "text-muted-foreground")}>
          {value || placeholder}
        </span>
      </div>
      {value
        ? <X size={16} className="text-muted-foreground shrink-0" onClick={e => { e.stopPropagation(); onClear(); }} />
        : <ChevronDown size={16} className={cn("text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180")} />
      }
    </button>
  );
}

// --- Mobile Dropdown ---
function MobileDropdown({ items, emptyLabel, onSelect, onClear, onClose, search, onSearch, searchPlaceholder }: {
  items: string[];
  emptyLabel: string;
  onSelect: (v: string) => void;
  onClear: () => void;
  onClose: () => void;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder: string;
}) {
  return (
    <div className="bg-surface border-y border-border animate-in fade-in duration-150">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-9 pr-3 text-sm bg-background rounded-lg border border-border focus:border-primary/50 focus:outline-none transition-colors"
          />
        </div>
      </div>
      {/* Items */}
      <div className="max-h-52 overflow-y-auto px-2 pb-2">
        <button
          type="button"
          onClick={onClear}
          className="w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-background rounded-lg transition-colors"
        >
          {emptyLabel}
        </button>
        {items.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
