import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { StructuredSearchBar } from "@/components/StructuredSearchBar";
import { Search, Bell, Globe, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const getCachedListingCount = unstable_cache(
  async () => {
    return prisma.listing.count();
  },
  ["listing-count"],
  { revalidate: 300, tags: ["listing-count"] }
);

export default async function HomePage(): Promise<ReactElement> {
  const totalListings = await getCachedListingCount().catch(() => 0);
  return (
    <div className="flex flex-col relative">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-32 lg:pb-40 text-foreground">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none z-0" />
        <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-cyber-purple/10 blur-[150px] pointer-events-none" />

        <div className="container relative z-10 px-4 sm:px-6">
          <div className="mx-auto max-w-4xl text-center">
            
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-bold text-primary backdrop-blur-xl shadow-[0_0_20px_rgba(0,216,255,0.2)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
              </span>
              <span className="tracking-widest uppercase text-[11px]">Live: {totalListings.toLocaleString()} Listings</span>
            </div>
            
            <h1 className="font-display text-4xl font-black tracking-tighter sm:text-7xl lg:text-8xl drop-shadow-2xl">
              <span className="bg-gradient-to-r from-foreground via-primary/80 to-primary bg-clip-text text-transparent">Nationwide</span> Car Search, 
              <br />One Simple Interface.
            </h1>
            
            <p className="mx-auto mt-8 max-w-2xl text-lg font-medium text-muted-foreground sm:text-xl">
              We continuously scrape Facebook Marketplace across the entire USA. 
              Search instantly and set precision alerts without ever opening Facebook.
            </p>
            
            <div className="mx-auto mt-12 max-w-5xl relative z-20">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-primary/20 via-cyber-purple/20 to-primary/20 opacity-50 blur-lg" />
              <div className="relative glass shadow-[0_0_50px_rgba(0,216,255,0.15)] rounded-[3rem] p-2 border border-black/10 dark:border-white/10 bg-background/50 backdrop-blur-2xl">
                <React.Suspense fallback={<div className="h-[80px] w-full animate-pulse bg-primary/5 rounded-2xl" />}>
                  <StructuredSearchBar />
                </React.Suspense>
              </div>
            </div>

            <p className="mt-10 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Link
                href="/search"
                className="group inline-flex items-center gap-2 text-primary hover:text-foreground transition-all drop-shadow-[0_0_8px_rgba(0,216,255,0.5)]"
              >
                Browse all indexed listings
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard 
            icon={<Search className="text-blue-500" />}
            title="Aggregated Search"
            description="Search across 50+ major US metropolitan areas simultaneously with advanced filtering."
          />
          <FeatureCard 
            icon={<Bell className="text-purple-500" />}
            title="Instant Alerts"
            description="Get notified via email the moment a vehicle matching your exact criteria is listed."
          />
          <FeatureCard 
            icon={<Globe className="text-emerald-500" />}
            title="Real-time Indexing"
            description="Our scrapers run around the clock to ensure you see deals before they're gone."
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string, description: string }) {
  return (
    <article className="group relative flex flex-col rounded-3xl border border-border/50 glass-card p-8 transition-all hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {description}
      </p>
    </article>
  );
}
