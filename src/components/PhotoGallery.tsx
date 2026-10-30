"use client";

import { useRef, useState } from "react";

/** Swipeable photo strip for the buyer page, with arrows on desktop and a 3 / 24 counter. */
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const go = (to: number) => {
    const el = strip.current;
    if (!el) return;
    const next = (to + photos.length) % photos.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  if (!photos.length) return null;
  return (
    <div className="gallery">
      <div
        ref={strip}
        className="gallery-strip"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`${alt}, photo ${i + 1}`} loading={i < 2 ? "eager" : "lazy"} />
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          <button type="button" className="gallery-arrow gallery-prev" aria-label="Previous photo" onClick={() => go(index - 1)}>
            ‹
          </button>
          <button type="button" className="gallery-arrow gallery-next" aria-label="Next photo" onClick={() => go(index + 1)}>
            ›
          </button>
          <p className="gallery-count">
            {index + 1} / {photos.length}
          </p>
        </>
      ) : null}
    </div>
  );
}
