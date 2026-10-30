"use client";

import { useEffect, useState, type ReactNode } from "react";

export type GraphicsTab = { id: string; label: string; note: string; count: number; content: ReactNode };

/**
 * Shows one group of graphics at a time (social posts, flyers) so the kit
 * page doesn't dump every size on the agent at once. A #<id> link opens that tab.
 */
export function GraphicsTabs({ tabs }: { tabs: GraphicsTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="gtabs">
      <div className="gtabs-bar">
        <div className="gtabs-list" role="tablist" aria-label="Graphics">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === current.id}
              aria-controls={`panel-${t.id}`}
              className="gtab"
              onClick={() => setActive(t.id)}
            >
              {t.label}
              <span className="gtab-count">{t.count}</span>
            </button>
          ))}
        </div>
        <p className="gtabs-note muted">{current.note}</p>
      </div>
      <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
        {current.content}
      </div>
    </div>
  );
}
