"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  totalPages: number;
  /** Serialized query string without `page` (may be empty). */
  queryWithoutPage: string;
};

export function Pagination({
  page,
  totalPages,
  queryWithoutPage,
}: Props): React.ReactElement {
  function hrefForPage(target: number): string {
    const params = new URLSearchParams(
      queryWithoutPage ? queryWithoutPage : undefined,
    );
    params.set("page", String(target));
    const q = params.toString();
    return q ? `/search?${q}` : `/search?page=${target}`;
  }

  const pageNumbers: number[] =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [
          1,
          totalPages,
          page - 1,
          page,
          page + 1,
        ].filter((n) => n >= 1 && n <= totalPages);

  const sortedUnique = [...new Set(pageNumbers)].sort((a, b) => a - b);

  return (
    <nav
      className="mt-16 flex flex-wrap items-center justify-center gap-2 pb-10"
      aria-label="Pagination"
    >
      <PaginationLink href={page <= 1 ? null : hrefForPage(page - 1)}>
        <ChevronLeft size={16} />
      </PaginationLink>
      
      {sortedUnique.map((n, idx) => (
        <React.Fragment key={n}>
          {idx > 0 && sortedUnique[idx - 1] !== undefined && n - sortedUnique[idx - 1]! > 1 ? (
            <span className="px-1 text-muted-foreground/30 font-bold">...</span>
          ) : null}
          <PaginationLink href={hrefForPage(n)} active={n === page}>
            {n}
          </PaginationLink>
        </React.Fragment>
      ))}
      
      <PaginationLink
        href={page >= totalPages ? null : hrefForPage(page + 1)}
      >
        <ChevronRight size={16} />
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  href,
  active,
  children,
}: {
  href: string | null;
  active?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  if (!href) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground/20">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 min-w-[2.5rem] items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-all transition-colors",
        active
          ? "border-primary bg-primary text-white shadow-blue"
          : "border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground hover:border-primary/40",
      )}
    >
      {children}
    </Link>
  );
}
