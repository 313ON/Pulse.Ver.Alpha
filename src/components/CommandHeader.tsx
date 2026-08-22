"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const sectionNames: Record<string, string> = {
  "/": "مرکز فرمان راهبردی",
  "/program": "نمای اجرایی برنامه",
  "/goals": "اهداف سازمانی",
  "/sub-goals": "اهداف جزئی",
  "/departments": "واحدهای عملیاتی",
  "/roles": "سمت‌ها و نقش‌ها",
  "/persons": "پرسنل",
  "/users": "کاربران",
  "/actions": "اقدامات",
  "/activities": "فعالیت‌ها",
  "/kpis": "شاخص‌های کلیدی",
  "/risks": "ریسک‌ها",
  "/dependencies": "وابستگی‌ها",
  "/imports": "ورودی داده‌ها",
  "/reports": "گزارش‌ها",
  "/settings": "تنظیمات"
};

export type SearchResult = {
  id: string;
  label: string;
  type: string;
};

const resultSections: Record<string, string> = {
  "هدف": "goals",
  "زیرهدف": "sub-goals",
  "فعالیت": "activities",
  "اقدام": "actions",
  "پرسنل": "persons",
  "واحد": "departments",
  "سمت": "roles",
  "شاخص": "kpis",
  "ریسک": "risks"
};

export function searchResultHref(result: SearchResult): string {
  return `/${resultSections[result.type] ?? "search"}/${encodeURIComponent(result.id)}`;
}

export function CommandHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [planYear, setPlanYear] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const section = sectionNames[pathname] ?? "نمای عملیاتی";

  useEffect(() => {
    setPlanYear(document.documentElement.dataset.planYear ?? null);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal })
        .then(async (response) => {
          const body = await response.json() as { results?: SearchResult[] };
          if (!response.ok) throw new Error("جستجو در داده‌ها ممکن نشد.");
          setResults(Array.isArray(body.results) ? body.results : []);
          setSearchOpen(true);
        })
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false);
        });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function openResult(result: SearchResult) {
    setQuery("");
    setResults([]);
    setSearchOpen(false);
    router.push(searchResultHref(result));
  }

  return (
    <header className="topbar command-header">
      <div className="command-context">
        <span className="command-kicker">PULSE / COMMAND</span>
        <span className="command-divider">/</span>
        <strong>{section}</strong>
      </div>
      <div className="top-actions">
        <div className="command-search-wrap">
          <label className="search command-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={inputRef}
              aria-label="جستجوی سراسری"
              aria-controls="global-search-results"
              aria-expanded={searchOpen}
              placeholder="جستجوی سراسری..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => { if (query.trim().length >= 2) setSearchOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results[0]) openResult(results[0]);
              }}
            />
            <kbd>⌘ K</kbd>
          </label>
          {searchOpen && query.trim().length >= 2 && (
            <div id="global-search-results" className="command-search-results" role="listbox" aria-label="نتایج جستجو">
              {searchLoading ? <div className="command-search-empty">در حال جستجو...</div> : results.length === 0 ? (
                <div className="command-search-empty">نتیجه‌ای پیدا نشد.</div>
              ) : results.map((result) => (
                <button
                  className="command-search-result"
                  key={`${result.type}:${result.id}`}
                  type="button"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openResult(result)}
                >
                  <span>{result.type}</span>
                  <strong>{result.label}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="icon-button command-alert" aria-label="اعلان‌ها">♧<i /></button>
        <div className="date-chip"><span>چرخه</span> {planYear ?? "—"}</div>
      </div>
    </header>
  );
}
