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

/** Deep-link state lives in the hash: #map?region=north&province=bac-ninh&zone=vsip */
function readHash() {
  if (typeof window === "undefined") return { tab: "map" };
  const [page, search] = window.location.hash.replace("#", "").split("?");
  const params = new URLSearchParams(search ?? "");
  const tab = TABS.includes(page.replace("/", "")) ? page.replace("/", "") : "map";
  return { tab, region: params.get("region"), province: params.get("province"), zone: params.get("zone") };
}

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
  const initial = useMemo(readHash, []);

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

  // Keep the hash in sync so any view can be shared or reloaded.
  useEffect(() => {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (provinceSlug) params.set("province", provinceSlug);
    if (zoneKey) params.set("zone", zoneKey.split("/")[1]);
    const search = params.toString();
    const nextHash = `#${tab}${search ? `?${search}` : ""}`;
    if (window.location.hash !== nextHash) window.history.replaceState(null, "", nextHash);
  }, [provinceSlug, region, tab, zoneKey]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, kind, provinceSlug, query, region, zoneKey, hostedOnly]);

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
        })
      ),
    [category, documents, hostedOnly, kind, provinceSlug, query, region, selectedZone]
  );

  const selectProvince = useCallback((slug) => {
    setProvinceSlug((current) => (current === slug ? null : slug));
    setZoneKey(null);
  }, []);

  const openRecords = useCallback((nextZoneKey = undefined) => {
    if (nextZoneKey !== undefined) setZoneKey(nextZoneKey);
    setTab("map");
    requestAnimationFrame(() => recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
        <button
          key={item}
          type="button"
          className={`docs-tab ${tab === item ? "is-active" : ""}`}
          aria-current={tab === item ? "page" : undefined}
          onClick={() => setTab(item)}
        >
          {dc.tabs[item]}
          {tabCounts[item] !== null ? <span>{tabCounts[item]}</span> : null}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="docs-page grid gap-5">
      <section className="docs-header is-single">
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
            <button type="button" className={`region-tab ${!region ? "is-active" : ""}`} onClick={() => setRegion(null)}>
              {dc.regionAll}
              <span>{stats.totals.documents}</span>
            </button>
            {stats.regions.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`region-tab ${region === item.id ? "is-active" : ""}`}
                style={{ "--region-color": item.color }}
                onClick={() => {
                  setRegion((current) => (current === item.id ? null : item.id));
                  setProvinceSlug(null);
                  setZoneKey(null);
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
                renderPopover={(slug) => {
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
              </div>
            </div>

            <ProvincePanel
              dc={dc}
              language={language}
              province={selectedProvince}
              zoneKey={zoneKey}
              onSelectZone={setZoneKey}
              onOpenRecords={openRecords}
              onClose={() => {
                setProvinceSlug(null);
                setZoneKey(null);
              }}
              regions={activeRegions}
              onSelectProvince={selectProvince}
            />
          </section>

          <div ref={recordsRef} className="docs-records-anchor" />

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
              {CATEGORIES.filter((item) => stats.byCategory[item.id]).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`docs-chip ${category === item.id ? "is-active" : ""}`}
                  style={{ "--chip-color": item.color }}
                  onClick={() => setCategory((current) => (current === item.id ? null : item.id))}
                >
                  {categoryLabel(item.id, language)}
                  <span>{stats.byCategory[item.id]}</span>
                </button>
              ))}
            </div>

            <div className="docs-chip-row is-secondary">
              <button type="button" className={`docs-chip ${!kind ? "is-active" : ""}`} onClick={() => setKind(null)}>
                {dc.filters.kind}: {dc.filters.all}
              </button>
              {Object.values(MEDIA_KINDS)
                .filter((item) => stats.byKind[item.id])
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`docs-chip ${kind === item.id ? "is-active" : ""}`}
                    onClick={() => setKind((current) => (current === item.id ? null : item.id))}
                  >
                    {KIND_ICONS[item.id]} {kindLabel(item.id, language)}
                    <span>{stats.byKind[item.id]}</span>
                  </button>
                ))}
            </div>
          </section>

          <section className="docs-grid" aria-label={dc.provincePanel.documents}>
            {scopedDocuments.slice(0, visibleCount).map((doc) => (
              <DocumentCard key={doc.id} doc={doc} dc={dc} language={language} onOpen={setViewerDoc} />
            ))}
            {!scopedDocuments.length ? <p className="docs-empty">{dc.provincePanel.empty}</p> : null}
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
          stats={stats}
          region={region}
          provinceSlug={provinceSlug}
          aiEnabled={health?.ai?.enabled ?? false}
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

function ProvincePanel({ dc, language, province, zoneKey, onSelectZone, onOpenRecords, onClose, regions, onSelectProvince }) {
  if (!province) {
    return (
      <aside className="docs-province-panel is-empty">
        <h2>{dc.mapHint}</h2>
        <ul className="docs-province-shortlist">
          {regions.flatMap((region) =>
            region.provinces.slice(0, 6).map((item) => (
              <li key={item.slug}>
                <button type="button" onClick={() => onSelectProvince(item.slug)}>
                  <span className="province-dot" style={{ background: region.color }} />
                  <span className="province-name">{item.name}</span>
                  <em>
                    {item.documentCount} · {item.zoneCount} KCN
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
      <header>
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

      {/* List view: fixed-height rows in a scroll container, so adding parks never resizes them. */}
      <div className="docs-zone-listview">
        <div className="docs-zone-listhead">
          <span>{dc.provincePanel.zones}</span>
          <span>{dc.provincePanel.coverageColumn}</span>
          <span>{dc.provincePanel.countColumn}</span>
        </div>

        <ul className="docs-zone-rows">
          <li>
            <button
              type="button"
              className={`docs-zone-row is-all ${!zoneKey ? "is-active" : ""}`}
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
      </div>
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
          {doc.kind === "pdf" ? <iframe src={`${url}#view=FitH`} title={doc.title} /> : null}
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
