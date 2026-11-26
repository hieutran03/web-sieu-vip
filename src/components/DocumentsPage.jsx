// Public site: geotechnical surveys and site layouts of Vietnam's industrial parks.
//
// Three tabs so nothing is crammed into one scroll:
//   map      — region filter, province choropleth, industrial-park list for the selected province
//   records  — the documents themselves, with search and filters, scoped by the map selection
//   insights — statistics computed from the record set
//
// Data comes from the committed catalog snapshot plus anything an admin has uploaded since.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { documentCopy } from "../documentCopy.js";
import { DISTRICT_LOCATIONS } from "../data/districtLocations.js";
import { readRoute, routeUrl } from "../lib/routes.js";
import {
  adminSession,
  api,
  canPreviewInline,
  CATEGORIES,
  computeStats,
  downloadUrl,
  filterDocuments,
  formatBytes,
  formatDate,
  isHosted,
  MEDIA_KINDS,
  mergeDocuments,
  REGIONS,
  snapshotDocuments,
  thumbnailUrl,
  viewUrl
} from "../lib/documents.js";
import { categoryLabel, kindLabel } from "../shared/classify.js";
import { AdminPanel } from "./AdminPanel.jsx";
import { DocumentAnalytics } from "./DocumentAnalytics.jsx";
import { googleMapsAvailable, ProvinceMap } from "./ProvinceMap.jsx";

// PDF.js is large; only fetch it when a self-hosted PDF is actually opened.
const PdfViewer = React.lazy(() => import("./PdfViewer.jsx"));

const KIND_ICONS = {
  image: "🖼️",
  pdf: "📄",
  document: "📝",
  spreadsheet: "📊",
  presentation: "📽️",
  drawing: "📐",
  video: "🎬",
  archive: "🗜️",
  link: "🔗",
  other: "📁"
};

const TABS = ["map", "insights"];
const PAGE_SIZE = 60;

/** Records a customer can open come first; the rest keep a stable alphabetical order. */
function sortForCustomers(documents) {
  return [...documents].sort((a, b) => {
    const openable = Number(isHosted(b)) - Number(isHosted(a));
    if (openable !== 0) return openable;
    return a.title.localeCompare(b.title, "vi");
  });
}

export function DocumentsPage({ language }) {
  const dc = documentCopy[language] ?? documentCopy.vi;
  const initial = useMemo(() => readRoute(window.location), []);

  const [tab, setTab] = useState(initial.tab);
  // The tab strip lives in the site header; the page owns the state and portals the buttons up.
  const [tabSlot, setTabSlot] = useState(null);
  const recordsRef = useRef(null);
  const [liveDocuments, setLiveDocuments] = useState([]);
  const [health, setHealth] = useState(null);
  const [session, setSession] = useState(() => adminSession.read());
  const [region, setRegion] = useState(initial.region ?? null);
  const [provinceSlug, setProvinceSlug] = useState(initial.province ?? null);
  const [zoneKey, setZoneKey] = useState(initial.province && initial.zone ? `${initial.province}/${initial.zone}` : null);
  const [districtKey, setDistrictKey] = useState(initial.district ?? null);
  const [category, setCategory] = useState(null);
  const [kind, setKind] = useState(null);
  const [query, setQuery] = useState("");
  const [hostedOnly, setHostedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [mapMode, setMapMode] = useState(() => {
    if (typeof window === "undefined") return "vector";
    return window.localStorage.getItem("v-tnf-map-mode") === "google" && googleMapsAvailable ? "google" : "vector";
  });

  const documents = useMemo(() => mergeDocuments(snapshotDocuments, liveDocuments), [liveDocuments]);
  const stats = useMemo(() => computeStats(documents), [documents]);

  const refreshLive = useCallback(async () => {
    try {
      const payload = await api.liveDocuments();
      setLiveDocuments(payload.documents ?? []);
    } catch {
      // Offline or API not deployed: the bundled snapshot is still fully usable.
    }
  }, []);

  useEffect(() => {
    setTabSlot(document.getElementById("app-tab-slot"));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then(setHealth)
      .catch(() => setHealth(null));
    refreshLive();
    return () => controller.abort();
  }, [refreshLive]);

  // Keep selections shareable and convert old hash links to the new routes.
  useEffect(() => {
    const url = routeUrl({ tab, region, province: provinceSlug, zone: zoneKey?.split("/")[1], district: districtKey });
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) window.history.replaceState(null, "", url);
  }, [provinceSlug, region, tab, zoneKey, districtKey]);

  useEffect(() => {
    const restore = () => {
      const state = readRoute(window.location);
      setTab(state.tab); setRegion(state.region); setProvinceSlug(state.province);
      setZoneKey(state.province && state.zone ? `${state.province}/${state.zone}` : null);
      setDistrictKey(state.district);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, kind, provinceSlug, query, region, zoneKey, districtKey, hostedOnly]);

  const countsBySlug = useMemo(() => {
    const counts = {};
    for (const province of stats.provinces) {
      if (region && province.region !== region) continue;
      counts[province.slug] = province.documentCount;
    }
    return counts;
  }, [region, stats.provinces]);

  const selectedProvince = useMemo(
    () => stats.provinces.find((province) => province.slug === provinceSlug) ?? null,
    [provinceSlug, stats.provinces]
  );

  const selectedZone = useMemo(
    () => (zoneKey ? stats.zones.find((zone) => zone.key === zoneKey) ?? null : null),
    [stats.zones, zoneKey]
  );
  const districtPoints = useMemo(() => DISTRICT_LOCATIONS.filter((point) =>
    (!region || stats.provinces.some((province) => province.slug === point.provinceSlug && province.region === region)) &&
    documents.some((doc) => doc.provinceSlug === point.provinceSlug && point.zones.includes(doc.zoneSlug) && doc.projectLocation)
  ), [documents, region, stats.provinces]);
  const selectedDistrict = districtPoints.find((point) => point.key === districtKey) ?? null;
  const districtDocuments = useMemo(() => selectedDistrict ? documents.filter((doc) =>
    doc.provinceSlug === selectedDistrict.provinceSlug && selectedDistrict.zones.includes(doc.zoneSlug) && doc.projectLocation
  ) : [], [documents, selectedDistrict]);
  const provinceDocuments = useMemo(() => provinceSlug ? sortForCustomers(documents.filter((doc) => doc.provinceSlug === provinceSlug)).slice(0, 2) : [], [documents, provinceSlug]);

  const scopedDocuments = useMemo(
    () =>
      sortForCustomers(
        filterDocuments(documents, {
          region,
          province: provinceSlug,
          zone: selectedZone?.zoneSlug,
          category,
          kind,
          query: query.trim() || undefined,
          hostedOnly
        }).filter((doc) => !selectedDistrict || (doc.provinceSlug === selectedDistrict.provinceSlug && selectedDistrict.zones.includes(doc.zoneSlug) && doc.projectLocation))
      ),
    [category, documents, hostedOnly, kind, provinceSlug, query, region, selectedZone, selectedDistrict]
  );
  const facetCounts = useMemo(() => {
    const common = { region, province: provinceSlug, zone: selectedZone?.zoneSlug, query: query.trim() || undefined, hostedOnly };
    const inDistrict = (doc) => !selectedDistrict || (doc.provinceSlug === selectedDistrict.provinceSlug && selectedDistrict.zones.includes(doc.zoneSlug) && doc.projectLocation);
    const tally = (items, field) => items.filter(inDistrict).reduce((counts, doc) => {
      counts[doc[field]] = (counts[doc[field]] ?? 0) + 1;
      return counts;
    }, {});
    return {
      categories: tally(filterDocuments(documents, { ...common, kind }), "category"),
      kinds: tally(filterDocuments(documents, { ...common, category }), "kind")
    };
  }, [documents, region, provinceSlug, selectedZone, selectedDistrict, query, hostedOnly, kind, category]);
  const analysisZone = selectedZone?.zoneSlug ?? (selectedDistrict?.zones.length === 1 ? selectedDistrict.zones[0] : undefined);
  const analysisStats = useMemo(() => computeStats(filterDocuments(documents, { region, province: provinceSlug, zone: analysisZone }).filter((doc) => !selectedDistrict || Boolean(doc.projectLocation))), [documents, region, provinceSlug, analysisZone, selectedDistrict]);

  const selectProvince = useCallback((slug) => {
    setProvinceSlug((current) => (current === slug ? null : slug));
    setZoneKey(null);
    setDistrictKey(null);
  }, []);

  const selectDistrict = useCallback((point) => {
    setProvinceSlug(point.provinceSlug);
    setZoneKey(null);
    setDistrictKey(point.key);
  }, []);

  const openRecords = useCallback((nextZoneKey = undefined) => {
    if (nextZoneKey !== undefined) setZoneKey(nextZoneKey);
    setTab("map");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => recordsRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  }, []);

  const resetFilters = useCallback(() => {
    setCategory(null);
    setKind(null);
    setQuery("");
    setHostedOnly(false);
  }, []);

  const activeRegions = region ? stats.regions.filter((item) => item.id === region) : stats.regions;
  const tabCounts = { map: scopedDocuments.length, insights: null };

  const tabStrip = (
    <nav className="docs-tabs" aria-label={dc.tabs.label}>
      {TABS.map((item) => (
        <a
          key={item}
          href={routeUrl({ tab: item, region, province: provinceSlug, zone: zoneKey?.split("/")[1], district: districtKey })}
          className={`docs-tab ${tab === item ? "is-active" : ""}`}
          aria-current={tab === item ? "page" : undefined}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (item !== tab) { window.history.pushState(null, "", event.currentTarget.href); setTab(item); }
          }}
        >
          {dc.tabs[item]}
          {tabCounts[item] !== null ? <span>{tabCounts[item]}</span> : null}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="docs-page grid gap-5">
      <section className="docs-header is-single">
        <span className="galaxy-meteor" aria-hidden="true" />
        <div>
          <div className="eyebrow">{dc.eyebrow}</div>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">{dc.title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{dc.intro}</p>
        </div>
      </section>

      {tabSlot ? createPortal(tabStrip, tabSlot) : null}

      {tab === "map" ? (
        <>
          <section className="docs-kpi-strip" aria-label={dc.analytics.title}>
            <KpiTile value={stats.totals.documents} label={dc.kpi.documents} />
            <KpiTile value={stats.byCategory.geology ?? 0} label={dc.kpi.geology} tone="jade" />
            <KpiTile value={stats.totals.zones} label={dc.kpi.zones} tone="sky" />
            <KpiTile value={stats.totals.provinces} label={dc.kpi.provinces} />
          </section>

          <section className="docs-region-tabs" aria-label={dc.regionAll}>
            <button type="button" className={`region-tab ${!region ? "is-active" : ""}`} onClick={() => { setRegion(null); setProvinceSlug(null); setZoneKey(null); setDistrictKey(null); }}>
              {dc.regionAll}
              <span>{stats.totals.documents}</span>
            </button>
            {stats.regions.filter((item) => item.documentCount > 0).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`region-tab ${region === item.id ? "is-active" : ""}`}
                style={{ "--region-color": item.color }}
                onClick={() => {
                  setRegion((current) => (current === item.id ? null : item.id));
                  setProvinceSlug(null);
                  setZoneKey(null);
                  setDistrictKey(null);
                }}
              >
                {item.name[language] ?? item.name.vi}
                <span>{item.documentCount}</span>
              </button>
            ))}
          </section>

          <section className="docs-workspace">
            <div className="docs-map-stage">
              <ProvinceMap
                region={region}
                countsBySlug={countsBySlug}
                selectedSlug={provinceSlug}
                onSelect={selectProvince}
                labelFor={(feature, count) => `${feature.properties.name}: ${count} ${dc.kpi.documents}`}
                mode={mapMode}
                language={language}
                zoomLabels={dc.zoom}
                districtPoints={districtPoints}
                onSelectDistrict={selectDistrict}
                selectedDistrictKey={districtKey}
                renderPopover={selectedDistrict ? undefined : (slug) => {
                  const province = stats.provinces.find((item) => item.slug === slug);
                  if (!province) return null;
                  return (
                    <ProvincePopoverCard
                      dc={dc}
                      language={language}
                      province={province}
                      onOpenRecords={() => openRecords(null)}
                      onClose={() => selectProvince(slug)}
                    />
                  );
                }}
              />
              {googleMapsAvailable ? (
                <div className="docs-map-modes" role="group" aria-label={dc.mapMode.label}>
                  {["vector", "google"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={mapMode === option ? "is-active" : ""}
                      onClick={() => {
                        setMapMode(option);
                        window.localStorage.setItem("v-tnf-map-mode", option);
                      }}
                    >
                      {dc.mapMode[option]}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="docs-map-legend">
                <strong>{dc.mapLegend}</strong>
                <div className="legend-scale">
                  {activeRegions.map((item) => (
                    <span key={item.id} className="legend-region">
                      <i style={{ background: item.color }} />
                      {item.name[language] ?? item.name.vi}
                      <b>{item.provinceCount}</b>
                    </span>
                  ))}
                  <span className="legend-region is-empty">
                    <i />
                    {dc.mapNoData}
                  </span>
                </div>
                <em>{dc.mapHint}</em>
                <em>{language === "ja" ? "点は旧行政区のおおよその位置です。" : language === "en" ? "Dots show approximate former district locations." : "Chấm thể hiện vị trí đại diện cấp quận/huyện theo địa chỉ cũ."} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></em>
              </div>
            </div>

            <ProvincePanel
              dc={dc}
              language={language}
              province={selectedProvince}
              zoneKey={zoneKey}
              onSelectZone={(key) => { setDistrictKey(null); setZoneKey(key); }}
              onOpenRecords={openRecords}
              onClose={() => {
                setProvinceSlug(null);
                setZoneKey(null);
                setDistrictKey(null);
              }}
              regions={activeRegions}
              onSelectProvince={selectProvince}
              districtPoints={districtPoints.filter((point) => point.provinceSlug === provinceSlug)}
              selectedDistrict={districtKey}
              onSelectDistrict={selectDistrict}
              districtDocuments={districtDocuments}
              provinceDocuments={provinceDocuments}
              onOpenDocument={setViewerDoc}
              onClearDistrict={() => setDistrictKey(null)}
            />
          </section>

          <div ref={recordsRef} className="docs-records-anchor" />

          {selectedDistrict ? <div className="district-selection">
            <span>{selectedDistrict.name} · {language === "ja" ? "区・郡のおおよその位置" : language === "en" ? "Approximate district location" : "Vị trí đại diện cấp quận/huyện"}</span>
            <a href={selectedDistrict.source} target="_blank" rel="noreferrer">{language === "ja" ? "位置の出典" : language === "en" ? "Location source" : "Nguồn vị trí"}</a>
            <button type="button" aria-label={language === "ja" ? "選択を解除" : language === "en" ? "Clear district" : "Bỏ chọn quận huyện"} onClick={() => setDistrictKey(null)}>×</button>
          </div> : null}

          <ScopeBar
            dc={dc}
            language={language}
            region={region}
            province={selectedProvince}
            zone={selectedZone}
            total={scopedDocuments.length}
            onClearRegion={() => setRegion(null)}
            onClearProvince={() => {
              setProvinceSlug(null);
              setZoneKey(null);
              setDistrictKey(null);
            }}
            onClearZone={() => setZoneKey(null)}
          />

          <section className="docs-filters" aria-label={dc.filters.category}>
            <div className="docs-filter-row">
              <input
                type="search"
                className="docs-search"
                value={query}
                placeholder={dc.filters.search}
                onChange={(event) => setQuery(event.target.value)}
              />
              <label className="docs-toggle">
                <input type="checkbox" checked={hostedOnly} onChange={(event) => setHostedOnly(event.target.checked)} />
                {dc.filters.hostedOnly}
              </label>
              <button type="button" className="docs-reset" onClick={resetFilters}>
                {dc.filters.reset}
              </button>
              <span className="docs-result-count">
                {scopedDocuments.length} {dc.filters.results}
              </span>
            </div>

            <div className="docs-chip-row">
              <button type="button" className={`docs-chip ${!category ? "is-active" : ""}`} onClick={() => setCategory(null)}>
                {dc.filters.all}
              </button>
              {CATEGORIES.filter((item) => facetCounts.categories[item.id] || item.id === category).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`docs-chip ${category === item.id ? "is-active" : ""}`}
                  style={{ "--chip-color": item.color }}
                  onClick={() => setCategory((current) => (current === item.id ? null : item.id))}
                >
                  {categoryLabel(item.id, language)}
                  <span>{facetCounts.categories[item.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="docs-chip-row is-secondary">
              <button type="button" className={`docs-chip ${!kind ? "is-active" : ""}`} onClick={() => setKind(null)}>
                {dc.filters.kind}: {dc.filters.all}
              </button>
              {Object.values(MEDIA_KINDS)
                .filter((item) => facetCounts.kinds[item.id] || item.id === kind)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`docs-chip ${kind === item.id ? "is-active" : ""}`}
                    onClick={() => setKind((current) => (current === item.id ? null : item.id))}
                  >
                    {KIND_ICONS[item.id]} {kindLabel(item.id, language)}
                    <span>{facetCounts.kinds[item.id] ?? 0}</span>
                  </button>
                ))}
            </div>
          </section>

          <section className="docs-grid" aria-label={dc.provincePanel.documents}>
            {scopedDocuments.slice(0, visibleCount).map((doc) => (
              <DocumentCard key={doc.id} doc={doc} dc={dc} language={language} onOpen={setViewerDoc} />
            ))}
            {!scopedDocuments.length ? <p className="docs-empty">{language === "ja" ? "条件に一致する資料がありません。" : language === "en" ? "No documents match these filters." : "Không có tài liệu phù hợp với bộ lọc."}</p> : null}
          </section>

          {scopedDocuments.length > visibleCount ? (
            <button type="button" className="docs-load-more" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
              {dc.filters.loadMore} ({scopedDocuments.length - visibleCount})
            </button>
          ) : null}
        </>
      ) : null}

      {tab === "insights" ? (
        <DocumentAnalytics
          dc={dc}
          language={language}
          stats={analysisStats}
          region={region}
          provinceSlug={provinceSlug}
          zoneSlug={analysisZone}
          aiEnabled={!selectedDistrict && (health?.ai?.enabled ?? false)}
        />
      ) : null}

      <div className="docs-admin-bar">
        <button type="button" className="docs-admin-link" onClick={() => setAdminOpen(true)}>
          {session ? dc.admin.loggedIn : dc.admin.login}
        </button>
      </div>

      {viewerDoc ? <DocumentViewer doc={viewerDoc} dc={dc} language={language} onClose={() => setViewerDoc(null)} /> : null}

      {adminOpen ? (
        <AdminPanel
          dc={dc}
          language={language}
          session={session}
          onSession={(next) => setSession(next)}
          health={health}
          stats={stats}
          onClose={() => setAdminOpen(false)}
          onUploaded={refreshLive}
        />
      ) : null}
    </div>
  );
}

/** Summary shown in the map popover, with the arrow pointing at the province. */
function ProvincePopoverCard({ dc, language, province, onOpenRecords, onClose }) {
  const regionMeta = REGIONS.find((item) => item.id === province.region);
  const topZones = province.zones.slice(0, 3);

  return (
    <div className="map-popover-card">
      <header>
        <div>
          <span className="map-popover-region" style={{ color: regionMeta?.color }}>
            {regionMeta ? regionMeta.name[language] ?? regionMeta.name.vi : ""}
          </span>
          <strong>{province.name}</strong>
        </div>
        <button type="button" onClick={onClose} aria-label={dc.provincePanel.close}>
          ×
        </button>
      </header>

      <dl>
        <div>
          <dt>{dc.provincePanel.documents}</dt>
          <dd>{province.documentCount}</dd>
        </div>
        <div>
          <dt>{dc.provincePanel.zonesShort}</dt>
          <dd>{province.zoneCount}</dd>
        </div>
        <div>
          <dt>{dc.provincePanel.completeShort}</dt>
          <dd>
            {province.completeZones}/{province.zoneCount}
          </dd>
        </div>
      </dl>

      {topZones.length ? (
        <ul className="map-popover-zones">
          {topZones.map((zone) => (
            <li key={zone.key}>
              <span>{zone.zoneName}</span>
              <em>{zone.documentCount}</em>
            </li>
          ))}
          {province.zoneCount > topZones.length ? <li className="is-more">+{province.zoneCount - topZones.length}</li> : null}
        </ul>
      ) : null}

      <button type="button" className="map-popover-cta" onClick={onOpenRecords}>
        {dc.provincePanel.openRecords} ({province.documentCount})
      </button>
    </div>
  );
}

function KpiTile({ value, label, tone = "ink" }) {
  return (
    <article className={`docs-kpi tone-${tone}`}>
      <strong>{value.toLocaleString("vi-VN")}</strong>
      <span>{label}</span>
    </article>
  );
}

/** What the record list is currently filtered to, with one-click ways out. */
function ScopeBar({ dc, language, region, province, zone, total, onClearRegion, onClearProvince, onClearZone }) {
  const regionMeta = REGIONS.find((item) => item.id === region);

  return (
    <div className="docs-scope-bar">
      <strong className="docs-scope-title">{dc.tabs.records}</strong>

      <div className="docs-scope-chips">
        {!region && !province && !zone ? <span className="docs-scope-chip is-static">{dc.regionAll}</span> : null}
        {regionMeta ? (
          <button type="button" className="docs-scope-chip" onClick={onClearRegion}>
            {regionMeta.name[language] ?? regionMeta.name.vi}
            <em>×</em>
          </button>
        ) : null}
        {province ? (
          <button type="button" className="docs-scope-chip" onClick={onClearProvince}>
            {province.name}
            <em>×</em>
          </button>
        ) : null}
        {zone ? (
          <button type="button" className="docs-scope-chip is-zone" onClick={onClearZone}>
            {zone.zoneName}
            <em>×</em>
          </button>
        ) : null}
      </div>

      <span className="docs-scope-total">
        {total} {dc.filters.results}
      </span>
    </div>
  );
}

function ProvincePanel({ dc, language, province, zoneKey, onSelectZone, onOpenRecords, onClose, regions, onSelectProvince, districtPoints, selectedDistrict, onSelectDistrict, districtDocuments, provinceDocuments, onOpenDocument, onClearDistrict }) {
  if (!province) {
    return (
      <aside className="docs-province-panel is-empty">
        <h2>{dc.mapHint}</h2>
        <ul key={regions.map((region) => region.id).join("-")} className="docs-province-shortlist map-selection-reveal">
          {regions.flatMap((region) =>
            region.provinces.slice(0, 6).map((item) => (
              <li key={item.slug}>
                <button type="button" onClick={() => onSelectProvince(item.slug)}>
                  <span className="province-dot" style={{ background: region.color }} />
                  <span className="province-name">{item.name}</span>
                  <em>
                    {item.documentCount} · {item.zoneCount} {dc.provincePanel.zonesShort}
                  </em>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
    );
  }

  const regionMeta = REGIONS.find((item) => item.id === province.region);

  return (
    <aside className="docs-province-panel">
      <header key={`header:${province.slug}`} className="map-selection-reveal">
        <div>
          <div className="eyebrow" style={{ color: regionMeta?.color }}>
            {regionMeta ? regionMeta.name[language] ?? regionMeta.name.vi : ""}
          </div>
          <h2>{province.name}</h2>
          {province.mergedInto && province.mergedInto !== province.name ? (
            <p className="docs-merged">
              {dc.provincePanel.mergedInto}: <strong>{province.mergedInto}</strong>
            </p>
          ) : null}
        </div>
        <button type="button" className="docs-panel-close" onClick={onClose} aria-label={dc.provincePanel.close}>
          ×
        </button>
      </header>

      <dl className="docs-province-stats">
        <div>
          <dt>{dc.provincePanel.documents}</dt>
          <dd>{province.documentCount}</dd>
        </div>
        <div>
          <dt>{dc.provincePanel.zones}</dt>
          <dd>{province.zoneCount}</dd>
        </div>
        <div>
          <dt>{dc.provincePanel.complete}</dt>
          <dd>
            {province.completeZones}/{province.zoneCount}
          </dd>
        </div>
        <div>
          <dt>{dc.provincePanel.lastUpdate}</dt>
          <dd>{formatDate(province.lastModified, language)}</dd>
        </div>
      </dl>

      {districtPoints.length ? <section className="district-shortlist" aria-label={language === "ja" ? "区・郡" : language === "en" ? "Districts" : "Quận/huyện"}>
        <div className="district-shortlist-heading">
          <strong>{language === "ja" ? "区・郡の地点" : language === "en" ? "District locations" : "Điểm quận/huyện"}</strong>
          <span>{language === "ja" ? "概略位置" : language === "en" ? "Approximate" : "Vị trí đại diện"}</span>
        </div>
        <div className="district-shortlist-items">{districtPoints.map((point) => <button key={point.key} type="button" className={selectedDistrict === point.key ? "is-active" : ""} aria-pressed={selectedDistrict === point.key} onClick={() => onSelectDistrict(point)}>{point.name}</button>)}</div>
      </section> : null}

      {selectedDistrict && districtDocuments.length ? <section key={selectedDistrict} className="district-details map-selection-reveal" aria-live="polite">
        <div className="district-details-header">
          <strong>{language === "ja" ? "選択した地点の資料" : language === "en" ? "Records at this location" : "Hồ sơ tại khu vực đã chọn"}</strong>
          <button type="button" onClick={onClearDistrict}>{language === "ja" ? "解除" : language === "en" ? "Clear" : "Bỏ chọn"}</button>
        </div>
        <p className="district-precision">{language === "ja" ? "地図上の点は旧区・郡の代表地点です。" : language === "en" ? "The map point represents the former district, not the exact project site." : "Điểm trên bản đồ đại diện cho quận/huyện cũ, chưa phải vị trí chính xác của công trình."}</p>
        {districtDocuments.map((doc) => <article className="district-record" key={doc.id}>
          <strong>{doc.projectLocation.project}</strong>
          <span>{doc.projectLocation.address}</span>
          <div className="district-record-actions">
            {isHosted(doc) ? <button type="button" onClick={() => onOpenDocument(doc)}>{dc.card.open}</button> : <span>{dc.card.onRequest}</span>}
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${doc.projectLocation.project}, ${doc.projectLocation.address}`)}`} target="_blank" rel="noreferrer">{language === "ja" ? "住所を検索" : language === "en" ? "Search address" : "Tra địa chỉ"}</a>
          </div>
        </article>)}
      </section> : null}

      {!selectedDistrict && provinceDocuments.length ? <section key={`preview:${province.slug}`} className="province-preview map-selection-reveal" aria-label={dc.provincePanel.documents}>
        <div className="province-preview-heading">
          <strong>{language === "ja" ? "資料を探す" : language === "en" ? "Explore records" : "Hồ sơ tại đây"}</strong>
          <button type="button" onClick={() => onOpenRecords(null)}>{dc.provincePanel.openRecords} ({province.documentCount}) →</button>
        </div>
        {provinceDocuments.map((doc) => <button className="province-preview-row" type="button" key={doc.id} onClick={() => isHosted(doc) ? onOpenDocument(doc) : onOpenRecords(null)}>
          <span aria-hidden="true">{KIND_ICONS[doc.kind] ?? "📁"}</span>
          <span><strong>{doc.title}</strong><small>{doc.zoneName || province.name}</small></span>
          <span aria-hidden="true">↗</span>
        </button>)}
      </section> : null}

      {/* List view: fixed-height rows in a scroll container, so adding parks never resizes them. */}
      {!selectedDistrict ? <div key={`zones:${province.slug}`} className="docs-zone-listview map-selection-reveal">
        <div className="docs-zone-listhead">
          <span>{dc.provincePanel.zones}</span>
          <span>{dc.provincePanel.coverageColumn}</span>
          <span>{dc.provincePanel.countColumn}</span>
        </div>

        <ul className="docs-zone-rows">
          <li>
            <button
              type="button"
              className={`docs-zone-row is-all ${!zoneKey && !selectedDistrict ? "is-active" : ""}`}
              onClick={() => {
                onSelectZone(null);
                onOpenRecords(null);
              }}
            >
              <span className="docs-zone-row-name">{dc.provincePanel.allZones}</span>
              <span className="docs-zone-row-coverage">—</span>
              <span className="docs-zone-row-count">{province.documentCount}</span>
            </button>
          </li>

          {province.zones.map((zone) => (
            <li key={zone.key}>
              <button
                type="button"
                className={`docs-zone-row coverage-${zone.coverage} ${zoneKey === zone.key ? "is-active" : ""}`}
                onClick={() => {
                  onSelectZone(zone.key);
                  onOpenRecords(zone.key);
                }}
                title={`${zone.zoneName} — ${dc.coverage[zone.coverage]} · ${zone.documentCount}`}
              >
                <span className="docs-zone-row-name">
                  {zone.zoneName}
                  {zone.archived ? <em className="docs-zone-flag">OLD</em> : null}
                </span>
                <span className="docs-zone-row-coverage">{dc.coverage[zone.coverage]}</span>
                <span className="docs-zone-row-count">{zone.documentCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </div> : null}

    </aside>
  );
}

function DocumentCard({ doc, dc, language, onOpen }) {
  const thumbnail = thumbnailUrl(doc);
  const hosted = isHosted(doc);

  return (
    <article className={`docs-card ${hosted ? "" : "is-share-only"}`}>
      <button type="button" className="docs-card-media" onClick={() => onOpen(doc)} disabled={!hosted}>
        {thumbnail ? (
          <img src={thumbnail} alt={doc.title} loading="lazy" />
        ) : (
          <span className="docs-card-glyph">{KIND_ICONS[doc.kind] ?? "📁"}</span>
        )}
        <span className="docs-card-kind">{kindLabel(doc.kind, language)}</span>
      </button>

      <div className="docs-card-body">
        <h3 title={doc.title}>{doc.title}</h3>
        <p className="docs-card-tags">
          {doc.zoneName ? <span className="docs-tag is-zone">{doc.zoneName}</span> : null}
          {doc.provinceName ? <span className="docs-tag">{doc.provinceName}</span> : null}
          <span className="docs-tag is-category">{categoryLabel(doc.category, language)}</span>
        </p>
        <p className="docs-card-meta">
          {formatBytes(doc.sizeBytes)} · {formatDate(doc.modifiedAt, language)}
        </p>
        {doc.projectLocation?.address ? (
          <div className="docs-card-location">
            <span>{doc.projectLocation.project}</span>
            <p>{doc.projectLocation.address}</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${doc.projectLocation.project}, ${doc.projectLocation.address}`)}`} target="_blank" rel="noreferrer">
              {language === "ja" ? "地図で住所を検索" : language === "en" ? "Search address on map" : "Tra địa chỉ trên bản đồ"}
            </a>
          </div>
        ) : null}
        <div className="docs-card-actions">
          {hosted ? (
            <>
              <button type="button" onClick={() => onOpen(doc)}>
                {dc.card.open}
              </button>
              <a href={downloadUrl(doc)} download>
                {dc.card.download}
              </a>
            </>
          ) : (
            <span className="docs-card-request">{dc.card.onRequest}</span>
          )}
        </div>
      </div>
    </article>
  );
}

// Self-hosted PDFs are the large ones (above the Cloudinary limit) and the store serves byte
// ranges, so they get the progressive PDF.js viewer; the rest keep the browser's own viewer.
function PdfFrame({ doc, url, dc }) {
  const iframe = <iframe src={`${url}#view=FitH`} title={doc.title} />;
  if (!doc.selfhost?.key) return iframe;
  const labels = { loading: dc.viewer.loading, page: dc.viewer.page };
  return (
    <React.Suspense fallback={<p className="docs-pdf-status">{labels.loading}</p>}>
      <PdfViewer url={url} labels={labels} fallback={iframe} />
    </React.Suspense>
  );
}

function DocumentViewer({ doc, dc, language, onClose }) {
  const url = viewUrl(doc);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="docs-viewer" role="dialog" aria-modal="true" aria-label={doc.title}>
      <div className="docs-viewer-backdrop" onClick={onClose} />
      <div className="docs-viewer-panel">
        <header>
          <div>
            <h2>{doc.title}</h2>
            <p>
              {doc.provinceName ? `${doc.provinceName} · ` : ""}
              {doc.zoneName ? `${doc.zoneName} · ` : ""}
              {categoryLabel(doc.category, language)} · {formatBytes(doc.sizeBytes)}
            </p>
          </div>
          <div className="docs-viewer-actions">
            <a href={url} target="_blank" rel="noreferrer">
              {dc.viewer.openNewTab}
            </a>
            <a href={downloadUrl(doc)} download>
              {dc.viewer.download}
            </a>
            <button type="button" onClick={onClose} aria-label={dc.viewer.close}>
              ×
            </button>
          </div>
        </header>

        <div className="docs-viewer-body">
          {doc.kind === "image" ? <img src={url} alt={doc.title} /> : null}
          {doc.kind === "pdf" ? <PdfFrame doc={doc} url={url} dc={dc} /> : null}
          {doc.kind === "video" ? <video src={url} controls preload="metadata" /> : null}
          {!canPreviewInline(doc) ? (
            <div className="docs-viewer-fallback">
              <span>{KIND_ICONS[doc.kind] ?? "📁"}</span>
              <p>{dc.card.noPreview}</p>
              <a className="docs-primary-link" href={downloadUrl(doc)} download>
                {dc.card.download}
              </a>
            </div>
          ) : null}
        </div>

        <footer>
          <span>
            {doc.provinceName ? `${doc.provinceName}` : ""}
            {doc.zoneName ? ` · ${doc.zoneName}` : ""}
          </span>
          <span>{formatDate(doc.modifiedAt, language)}</span>
        </footer>
      </div>
    </div>
  );
}
