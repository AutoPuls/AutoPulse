"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Menu, X, Bell, Search, CarFront, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSearchFilters } from "@/components/SearchFiltersContext";

export function Navbar(): React.ReactElement {
  const pathname = usePathname();
  const { setAlertOpen } = useSearchFilters();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { label: "Find Cars", href: "/search", icon: Search },
    { label: "My Alerts", href: "/alerts", icon: Bell },
  ];

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full sm:top-6 sm:left-1/2 sm:w-auto sm:max-w-5xl sm:-translate-x-1/2">
      <header className="relative overflow-hidden border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/60 px-4 py-2 backdrop-blur-3xl shadow-lg transition-all duration-500 sm:rounded-full sm:border sm:px-6 sm:py-3 sm:bg-white/40 sm:dark:bg-black/40">
        <div className="flex h-11 items-center justify-between sm:h-12">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-glow rounded-lg bg-primary/20 blur-md sm:rounded-xl" />
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyber-blue to-cyber-purple text-primary-foreground shadow-lg transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110 sm:h-10 sm:w-10 sm:rounded-xl">
                <CarFront size={18} className="drop-shadow-sm sm:size-[22px]" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-black leading-tight tracking-tighter text-foreground sm:text-xl">
                AUTO<span className="text-primary">PULSE</span>
              </span>
              <span className="hidden text-[10px] font-bold uppercase tracking-widest text-primary/60 leading-none sm:block">USA Aggregator</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold tracking-tight transition-all duration-300",
                    isActive 
                      ? "text-primary-foreground shadow-lg" 
                      : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 -z-10 rounded-full bg-cyber-gradient shadow-[0_4px_12px_rgba(0,242,254,0.4)]" />
                  )}
                  <item.icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground transition-colors hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground sm:h-10 sm:w-10"
            >
              {mounted && (theme === "dark" ? <Sun size={18} className="text-amber-400 sm:size-5" /> : <Moon size={18} className="sm:size-5" />)}
            </Button>
            
            <Button
              size="sm"
              onClick={() => setAlertOpen(true)}
              className="relative h-9 w-9 overflow-hidden rounded-full bg-black/10 dark:bg-white/10 p-0 font-bold text-foreground dark:text-white transition-all hover:bg-black/20 dark:hover:bg-white/20 active:scale-95 group/btn sm:h-auto sm:w-auto sm:px-5 sm:py-5"
            >
              <div className="absolute inset-0 -translate-x-full bg-cyber-gradient transition-transform duration-500 group-hover/btn:translate-x-0" />
              <span className="relative flex items-center justify-center gap-2">
                <Bell size={16} className="group-hover/btn:animate-bounce" />
                <span className="hidden sm:inline">Notify Me</span>
              </span>
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground md:hidden"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-white/40 dark:bg-black/20 p-2 border border-black/5 dark:border-white/5 md:hidden animate-in fade-in slide-in-from-top-4 duration-300">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center gap-4 rounded-xl px-5 py-4 text-base font-bold transition-all",
                  pathname === item.href 
                    ? "bg-cyber-gradient text-primary-foreground shadow-lg" 
                    : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon size={20} />
                {item.label}
              </Link>
            ))}
            <Button
              className="mt-2 w-full rounded-xl bg-cyber-gradient py-6 text-base font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
              onClick={() => {
                setAlertOpen(true);
                setIsMenuOpen(false);
              }}
            >
              <Bell size={18} className="mr-2" />
              AI Search Sentinel
            </Button>
          </div>
        )}
      </header>
    </div>
      </header>
    </div>
  );
}
