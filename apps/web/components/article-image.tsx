"use client";

import Link from "next/link";
import { useState } from "react";

interface ArticleImageProps {
  href: string;
  src?: string | null;
  alt: string;
  label: string;
  variant?: "card" | "hero";
  newTab?: boolean;
}

const minimumWidths = {
  card: 560,
  hero: 960
} as const;

export function ArticleImage({ href, src, alt, label, variant = "card", newTab = false }: ArticleImageProps) {
  const [showFallback, setShowFallback] = useState(!src);
  const isExternal = /^https?:\/\//.test(href);

  const fallbackClassName =
    variant === "hero"
      ? "article-hero-visual article-hero-fallback"
      : "article-visual article-visual-fallback";

  const fallbackChild = <span>{label}</span>;

  if (showFallback || !src) {
    if (isExternal) {
      return (
        <a href={href} className={fallbackClassName} target="_blank" rel="noreferrer" aria-hidden="true">
          {fallbackChild}
        </a>
      );
    }

    return (
      <Link href={href} className={fallbackClassName} aria-hidden="true" target={newTab ? "_blank" : undefined} rel={newTab ? "noreferrer" : undefined}>
        {fallbackChild}
      </Link>
    );
  }

  const image = (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setShowFallback(true)}
      onLoad={(event) => {
        if (event.currentTarget.naturalWidth < minimumWidths[variant]) {
          setShowFallback(true);
        }
      }}
    />
  );

  if (isExternal) {
    return (
      <a href={href} className={variant === "hero" ? "article-hero-visual" : "article-visual"} target="_blank" rel="noreferrer">
        {image}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={variant === "hero" ? "article-hero-visual" : "article-visual"}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noreferrer" : undefined}
    >
      {image}
    </Link>
  );
}
