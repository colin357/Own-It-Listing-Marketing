"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  label: string;
  placeId?: string;
}

/** Short pause so a burst of keystrokes sends one request, not one per letter. */
const DEBOUNCE_MS = 120;
const MIN_CHARS = 3;

const newSession = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);

/**
 * The property address box with suggestions as the LO types. Picking one
 * fills in the full address (with ZIP); typing any address by hand still works.
 */
export function AddressInput({ slug, token, defaultValue }: { slug: string; token: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef(newSession());
  const picked = useRef(defaultValue ?? "");
  const listId = useId();
  const base = `/build/${encodeURIComponent(slug)}/${encodeURIComponent(token)}/suggest`;

  // Results show while the LO is still typing: requests are not cancelled by the
  // next keystroke (that left nothing on screen until typing stopped). Answers
  // older than the list on screen are dropped, and the last list stays up meanwhile.
  const seq = useRef(0);
  /** The newest request whose results are on screen. */
  const shown = useRef(0);
  const cache = useRef(new Map<string, Suggestion[]>());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (q.length < MIN_CHARS || q === picked.current) {
      shown.current = ++seq.current;
      setItems([]);
      setLoading(false);
      return;
    }
    const key = q.toLowerCase();
    const hit = cache.current.get(key);
    if (hit) {
      shown.current = ++seq.current;
      setItems(hit);
      setLoading(false);
      setOpen(true);
      return;
    }
    setLoading(true);
    setOpen(true);
    const t = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`${base}?${new URLSearchParams({ q, session: session.current })}`);
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        const list = data.suggestions ?? [];
        cache.current.set(key, list);
        // An answer for an earlier prefix still beats an empty list while the LO
        // keeps typing; only answers older than what's on screen are dropped.
        if (mine < shown.current) return;
        shown.current = mine;
        setItems(list);
        setActive(-1);
      } catch {
        /* offline or slow: the box still works without suggestions */
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, base]);

  async function pick(s: Suggestion) {
    setOpen(false);
    setItems([]);
    picked.current = s.label;
    setValue(s.label);
    if (s.placeId) {
      try {
        const res = await fetch(`${base}?${new URLSearchParams({ place: s.placeId, session: session.current })}`);
        const { address } = (await res.json()) as { address?: string | null };
        if (address) {
          picked.current = address;
          setValue(address);
        }
      } catch {
        /* keep the suggestion text */
      }
    }
    session.current = newSession();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const typed = value.trim().length >= MIN_CHARS && value.trim() !== picked.current;
  const showList = open && typed && (items.length > 0 || loading || value.trim().length >= 6);

  return (
    <div className="addr">
      <input
        name="address"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
        placeholder="Start typing the address"
        autoComplete="off"
        autoFocus
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      />
      {showList ? (
        <ul className="addr-list" id={listId} role="listbox">
          {items.length === 0 ? (
            <li className="addr-status" role="presentation" aria-live="polite">
              {loading ? "Searching addresses…" : "No matches yet. Keep typing, or enter the full address."}
            </li>
          ) : null}
          {items.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "is-active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {s.label}
            </li>
          ))}
          {items.length > 0 && loading ? <li className="addr-status addr-status-sm" role="presentation">Updating…</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
