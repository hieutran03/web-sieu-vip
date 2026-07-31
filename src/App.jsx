import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip
} from "chart.js";
import { appCopy } from "./appCopy.js";
import { DocumentsPage } from "./components/DocumentsPage.jsx";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip
);

const languages = [
  { id: "vi", short: "VI", label: "Tiếng Việt" },
  { id: "en", short: "EN", label: "English" },
  { id: "ja", short: "JP", label: "日本語" }
];

const LANGUAGE_STORAGE_KEY = "v-tnf-language";

function getInitialLanguage() {
  if (typeof window === "undefined") return "vi";

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && appCopy[stored]) return stored;

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("ja")) return "ja";
  if (browser.startsWith("en")) return "en";
  return "vi";
}

function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const t = appCopy[language] ?? appCopy.vi;

  const changeLanguage = useCallback((next) => {
    setLanguage(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.app.title;
  }, [language, t]);

  return (
    <div className="app-shell min-h-screen bg-paper text-ink">
      <Topbar language={language} onLanguageChange={changeLanguage} t={t} />

      <main id="content" className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <DocumentsPage language={language} />
      </main>

      <footer className="site-footer">
        <span>{t.app.footer}</span>
        <span>{t.app.contact}</span>
      </footer>
    </div>
  );
}

function Topbar({ language, onLanguageChange, t }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper shadow-soft">
      <div className="topbar-accent" />
      <div className="topbar-layout has-tabs">
        <div className="brand-button is-static">
          <span className="brand-mark">
            <svg className="absolute inset-0 opacity-[0.22]" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path
                d="M27 6 C32 8, 33 14, 30 19 C27 23, 22 27, 21 32 C20 36, 22 38, 24 40"
                stroke="oklch(62% 0.13 168)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <span className="relative z-10 text-[0.7rem] font-black tracking-[0.02em]">TNF</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-normal">{t.app.title}</span>
            <span className="hidden max-w-[640px] truncate text-xs font-medium text-muted sm:block">{t.app.subtitle}</span>
          </span>
        </div>

        <div className="topbar-actions">
          <LanguageSelect language={language} onLanguageChange={onLanguageChange} t={t} />
        </div>

        {/* The page portals its section tabs in here so they sit in the header. */}
        <div className="topbar-tabs" id="app-tab-slot" />
      </div>
    </header>
  );
}

function LanguageSelect({ language, onLanguageChange, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const selectedLanguage = languages.find((item) => item.id === language) ?? languages[0];

  const updateMenuPosition = useCallback(() => {
    if (typeof window === "undefined" || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportGutter = 12;

    setMenuPosition({
      top: `${rect.bottom + 6}px`,
      right: `${Math.max(viewportGutter, window.innerWidth - rect.right)}px`
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    updateMenuPosition();

    const closeOnOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  return (
    <div className="language-dropdown shrink-0" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        className="language-dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t.common.language}
        onClick={() => {
          updateMenuPosition();
          setIsOpen((current) => !current);
        }}
      >
        <span className={`flag flag-${selectedLanguage.id}`} aria-hidden="true" />
        <span>{selectedLanguage.short}</span>
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="language-menu is-portal"
              role="listbox"
              aria-label={t.common.language}
              style={menuPosition ?? undefined}
            >
              {languages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`language-option ${language === item.id ? "is-active" : ""}`}
                  role="option"
                  aria-selected={language === item.id}
                  onClick={() => {
                    onLanguageChange(item.id);
                    setIsOpen(false);
                  }}
                >
                  <span className={`flag flag-${item.id}`} aria-hidden="true" />
                  <span className="language-option-text">
                    <strong>{item.short}</strong>
                    <span>{item.label}</span>
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default App;
