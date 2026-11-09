"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Suggestion {
  label: string;
  placeId?: string;
}

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

  useEffect(() => {
    const q = value.trim();
    if (q.length < 4 || q === picked.current) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${base}?${new URLSearchParams({ q, session: session.current })}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { suggestions?: Suggestion[] };
        setItems(data.suggestions ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* typing on, or offline: keep the box usable without suggestions */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
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

  const showList = open && items.length > 0;

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
        </ul>
      ) : null}
    </div>
  );
}
