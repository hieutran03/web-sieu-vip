// Province choropleth for the whole Vietnamese territory — mainland plus the Hoàng Sa and
// Trường Sa archipelagos, drawn on the same map, at their real position.
//
// Two renderers share the same geometry, colours and interactions:
//   "vector" (default) — inline SVG with pan/zoom. No API key, no quota, paints immediately.
//   "google"           — Google base map underneath for terrain/satellite context.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { APIProvider, InfoWindow, Map, useMap } from "@vis.gl/react-google-maps";
import { EAST_SEA_LABEL, ISLAND_GROUPS } from "../data/vietnamIslands.js";
import { provinceFeatures } from "../lib/documents.js";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const MAP_CENTER = { lat: 15.2, lng: 110.5 };
const MAP_ZOOM = 5;

const ZOOM_MIN = 1;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.45;

// Google Maps only accepts hex/rgb, so the choropleth is mixed in sRGB from these bases.
const REGION_BASE = {
  north: [47, 111, 181],
  central: [184, 134, 47],
  south: [31, 122, 90]
};
const EMPTY_FILL = [232, 234, 230];
const EMPTY_STROKE = [186, 190, 184];

function mix(from, to, amount) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

function toHex(rgb) {
  return `#${rgb.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0")).join("")}`;
}

/** Light for few documents, saturated for many. `ratio` is 0..1 against the busiest province. */
export function provinceFill(count, max, region) {
  if (!count) return toHex(EMPTY_FILL);
  const base = REGION_BASE[region] ?? REGION_BASE.south;
  const ratio = max > 0 ? Math.min(1, count / max) : 0;
  // Start well above white so even a single record is clearly "has data".
  return toHex(mix([255, 255, 255], base, 0.34 + 0.66 * Math.pow(ratio, 0.5)));
}

export function provinceStroke(region, hasData = true) {
  if (!hasData) return toHex(EMPTY_STROKE);
  // Darker than the fill so a province with data reads as an outlined, raised shape.
  return toHex(mix(REGION_BASE[region] ?? REGION_BASE.south, [0, 0, 0], 0.45));
}

function useVisibleFeatures(region) {
  return useMemo(() => provinceFeatures.filter((feature) => !region || feature.properties.region === region), [region]);
}

/* ─── SVG renderer ─────────────────────────────────────────────────── */

/**
 * Equirectangular projection over the full territory: the province bounds *and* the archipelagos,
 * so Hoàng Sa and Trường Sa appear on the map itself rather than in a separate box.
 */
function svgProjection(features, { includeIslands }) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    const [featureMinLng, featureMinLat, featureMaxLng, featureMaxLat] = feature.properties.bbox;
    minLng = Math.min(minLng, featureMinLng);
    minLat = Math.min(minLat, featureMinLat);
    maxLng = Math.max(maxLng, featureMaxLng);
    maxLat = Math.max(maxLat, featureMaxLat);
  }

  if (includeIslands) {
    for (const group of ISLAND_GROUPS) {
      for (const [lng, lat] of group.points) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  const padding = 0.5;
  minLng -= padding;
  maxLng += padding;
  minLat -= padding;
  maxLat += padding;

  const width = 1000;
  const height = Math.round((width * (maxLat - minLat)) / (maxLng - minLng) / Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180));

  return {
    width,
    height,
    project: ([lng, lat]) => [
      ((lng - minLng) / (maxLng - minLng)) * width,
      height - ((lat - minLat) / (maxLat - minLat)) * height
    ]
  };
}

/** Pan/zoom state for the SVG map, plus the maths to place HTML overlays on top of it. */
function useMapTransform(projection) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [box, setBox] = useState(null);
  const dragRef = useRef(null);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === "undefined") return;
    const measure = () => setBox(svg.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  /** preserveAspectRatio="xMidYMid meet" letterboxes the drawing; this is that geometry. */
  const layout = useMemo(() => {
    if (!box || !box.width || !box.height) return null;
    const displayScale = Math.min(box.width / projection.width, box.height / projection.height);
    return {
      displayScale,
      offsetX: (box.width - projection.width * displayScale) / 2,
      offsetY: (box.height - projection.height * displayScale) / 2
    };
  }, [box, projection.height, projection.width]);

  /** Projection units -> pixels inside the map stage (accounting for the current pan/zoom). */
  const toPixels = useCallback(
    ([x, y]) => {
      if (!layout) return null;
      return {
        left: layout.offsetX + (x * view.scale + view.x) * layout.displayScale,
        top: layout.offsetY + (y * view.scale + view.y) * layout.displayScale
      };
    },
    [layout, view.scale, view.x, view.y]
  );

  const zoomBy = useCallback(
    (factor) => {
      const center = { x: projection.width / 2, y: projection.height / 2 };
      setView((current) => {
        const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.scale * factor));
        if (scale === current.scale) return current;
        const ratio = scale / current.scale;
        return { scale, x: center.x - (center.x - current.x) * ratio, y: center.y - (center.y - current.y) * ratio };
      });
    },
    [projection.height, projection.width]
  );

  const reset = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  const onWheel = useCallback(
    (event) => {
      event.preventDefault();
      const svg = svgRef.current;
      if (!svg || !layout) return;
      const rect = svg.getBoundingClientRect();
      const focus = {
        x: (event.clientX - rect.left - layout.offsetX) / layout.displayScale,
        y: (event.clientY - rect.top - layout.offsetY) / layout.displayScale
      };
      setView((current) => {
        const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current.scale * factor));
        if (scale === current.scale) return current;
        const ratio = scale / current.scale;
        return { scale, x: focus.x - (focus.x - current.x) * ratio, y: focus.y - (focus.y - current.y) * ratio };
      });
    },
    [layout]
  );

  const onPointerDown = useCallback(
    (event) => {
      if (event.button !== 0 || !layout) return;
      dragRef.current = { startX: event.clientX, startY: event.clientY, moved: false };
    },
    [layout]
  );

  const onPointerMove = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || !layout) return;
      const dx = (event.clientX - drag.startX) / layout.displayScale;
      const dy = (event.clientY - drag.startY) / layout.displayScale;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      drag.startX = event.clientX;
      drag.startY = event.clientY;
      setView((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
    },
    [layout]
  );

  const endDrag = useCallback(() => {
    const moved = dragRef.current?.moved ?? false;
    dragRef.current = null;
    return moved;
  }, []);

  return { svgRef, view, layout, toPixels, zoomBy, reset, onWheel, onPointerDown, onPointerMove, endDrag };
}

/** The archipelagos, drawn in place with a label — same map, real coordinates. */
function IslandOverlay({ projection, language, scale }) {
  const labelSize = 20 / Math.sqrt(scale);
  const subSize = 15 / Math.sqrt(scale);
  const dotRadius = 3.4 / Math.sqrt(scale);
  const [seaX, seaY] = projection.project(EAST_SEA_LABEL.anchor);

  return (
    <g className="island-layer">
      <text x={seaX} y={seaY} className="sea-label" textAnchor="middle" fontSize={labelSize * 1.15}>
        {EAST_SEA_LABEL.name[language] ?? EAST_SEA_LABEL.name.vi}
      </text>

      {ISLAND_GROUPS.map((group) => {
        const [labelX, labelY] = projection.project(group.labelAnchor);
        const name = group.name[language] ?? group.name.vi;
        const province = group.province[language] ?? group.province.vi;

        return (
          <g key={group.id} className="island-group">
            <title>{`${name} — ${province}`}</title>
            {group.points.map((point, index) => {
              const [cx, cy] = projection.project(point);
              return <circle key={index} cx={cx} cy={cy} r={dotRadius} className="island-dot" />;
            })}
            <text x={labelX} y={labelY - labelSize * 1.4} className="island-label" textAnchor="middle" fontSize={labelSize}>
              {name}
            </text>
            <text x={labelX} y={labelY - labelSize * 1.4 + subSize * 1.2} className="island-sublabel" textAnchor="middle" fontSize={subSize}>
              {province}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SvgProvinceMap({
  features,
  countsBySlug,
  maxCount,
  selectedSlug,
  onSelect,
  labelFor,
  language = "vi",
  showIslands = true,
  zoomLabels,
  renderPopover
}) {
  const projection = useMemo(() => svgProjection(features, { includeIslands: showIslands }), [features, showIslands]);
  const { svgRef, view, toPixels, zoomBy, reset, onWheel, onPointerDown, onPointerMove, endDrag } = useMapTransform(projection);
  const dragEndedRef = useRef(false);

  // Wheel needs a non-passive listener so it can preventDefault.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (event) => onWheel(event);
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [onWheel, svgRef]);

  const shapes = features.map((feature) => {
    const { slug, region, name } = feature.properties;
    const count = countsBySlug[slug] ?? 0;
    return {
      slug,
      region,
      name,
      count,
      center: feature.properties.center,
      isSelected: slug === selectedSlug,
      d: feature.geometry.coordinates
        .map((polygon) =>
          polygon
            .map((ring) => `M${ring.map((point) => projection.project(point).map((value) => value.toFixed(1)).join(",")).join("L")}Z`)
            .join("")
        )
        .join(""),
      label: labelFor ? labelFor(feature, count) : `${name}: ${count}`
    };
  });

  // Empty provinces first, then provinces with data, then the selected one: later paints win.
  const ordered = [
    ...shapes.filter((shape) => !shape.count),
    ...shapes.filter((shape) => shape.count && !shape.isSelected),
    ...shapes.filter((shape) => shape.count && shape.isSelected)
  ];

  const selected = shapes.find((shape) => shape.isSelected);
  // `center` is stored as [lat, lng].
  const anchor = selected?.center ? toPixels(projection.project([selected.center[1], selected.center[0]])) : null;

  return (
    <>
      <svg
        ref={svgRef}
        className={`province-svg-map ${view.scale > 1 ? "is-zoomed" : ""}`}
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        role="group"
        aria-label="Vietnam provinces"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          dragEndedRef.current = endDrag();
        }}
        onPointerLeave={(event) => {
          if (event.buttons !== 0) dragEndedRef.current = endDrag();
        }}
      >
        <defs>
          <filter id="province-lift" x="-14%" y="-14%" width="132%" height="132%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.6" floodColor="#0b241d" floodOpacity="0.42" />
          </filter>
          <filter id="province-lift-strong" x="-18%" y="-18%" width="142%" height="142%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0b241d" floodOpacity="0.55" />
          </filter>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {ordered.map((shape) => (
            <path
              key={shape.slug}
              d={shape.d}
              fill={provinceFill(shape.count, maxCount, shape.region)}
              fillOpacity={shape.count ? (shape.isSelected ? 1 : 0.9) : 0.5}
              stroke={shape.isSelected ? "#0b241d" : provinceStroke(shape.region, shape.count > 0)}
              strokeWidth={(shape.isSelected ? 3.6 : shape.count ? 2.1 : 0.6) / view.scale}
              strokeLinejoin="round"
              filter={shape.count ? (shape.isSelected ? "url(#province-lift-strong)" : "url(#province-lift)") : undefined}
              className={`province-shape ${shape.count ? "has-docs" : "is-empty"} ${shape.isSelected ? "is-selected" : ""}`}
              tabIndex={shape.count ? 0 : -1}
              role={shape.count ? "button" : undefined}
              aria-label={shape.label}
              onClick={() => {
                if (dragEndedRef.current) {
                  dragEndedRef.current = false;
                  return;
                }
                if (shape.count) onSelect(shape.slug);
              }}
              onKeyDown={(event) => {
                if (shape.count && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelect(shape.slug);
                }
              }}
            >
              <title>{shape.label}</title>
            </path>
          ))}

          {showIslands ? <IslandOverlay projection={projection} language={language} scale={view.scale} /> : null}
        </g>
      </svg>

      {renderPopover && selected && anchor ? <MapPopover anchor={anchor}>{renderPopover(selected.slug)}</MapPopover> : null}

      <div className="docs-map-zoom" role="group" aria-label={zoomLabels?.label ?? "Zoom"}>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label={zoomLabels?.zoomIn ?? "Zoom in"} disabled={view.scale >= ZOOM_MAX}>
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label={zoomLabels?.zoomOut ?? "Zoom out"} disabled={view.scale <= ZOOM_MIN}>
          −
        </button>
        <button type="button" onClick={reset} aria-label={zoomLabels?.reset ?? "Reset"} disabled={view.scale === 1 && view.x === 0 && view.y === 0}>
          ⟲
        </button>
      </div>
    </>
  );
}

/**
 * Popover pinned to a point on the map with an arrow pointing at it. It measures itself and flips
 * below the anchor (or shifts sideways) when it would leave the map stage.
 */
function MapPopover({ anchor, children }) {
  const ref = useRef(null);
  const [size, setSize] = useState(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const parent = ref.current.parentElement?.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height, parentWidth: parent?.width ?? 0, parentHeight: parent?.height ?? 0 });
  }, [anchor.left, anchor.top, children]);

  const gap = 14;
  let left = anchor.left;
  let top = anchor.top - gap;
  let placement = "above";
  let arrowOffset = 0;

  if (size) {
    const halfWidth = size.width / 2;
    const clampedLeft = Math.min(Math.max(left, halfWidth + 8), Math.max(halfWidth + 8, size.parentWidth - halfWidth - 8));
    arrowOffset = left - clampedLeft;
    left = clampedLeft;

    if (anchor.top - size.height - gap < 8) {
      placement = "below";
      top = anchor.top + gap;
    }
  }

  return (
    <div
      ref={ref}
      className={`map-popover is-${placement}`}
      style={{ left, top, "--arrow-offset": `${arrowOffset}px` }}
      role="dialog"
    >
      {children}
    </div>
  );
}

/* ─── Google renderer ──────────────────────────────────────────────── */

/** Marks both archipelagos on the Google base map with their administrative province. */
function IslandMarkers({ language }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const overlays = ISLAND_GROUPS.flatMap((group) => {
      const title = `${group.name[language] ?? group.name.vi} — ${group.province[language] ?? group.province.vi}`;
      const dots = group.points.map(
        ([lng, lat]) =>
          new window.google.maps.Circle({
            map,
            center: { lat, lng },
            radius: 9000,
            title,
            fillColor: "#0b241d",
            fillOpacity: 0.85,
            strokeColor: "#ffffff",
            strokeWeight: 1,
            clickable: false,
            zIndex: 20
          })
      );

      const label = new window.google.maps.Marker({
        map,
        position: { lat: group.labelAnchor[1], lng: group.labelAnchor[0] },
        title,
        clickable: false,
        zIndex: 21,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: {
          text: group.name[language] ?? group.name.vi,
          className: "island-map-label",
          color: "#0b241d",
          fontSize: "12px",
          fontWeight: "800"
        }
      });

      return [...dots, label];
    });

    return () => {
      for (const overlay of overlays) overlay.setMap(null);
    };
  }, [language, map]);

  return null;
}

/**
 * Draws the provinces with the Maps Data layer: one addGeoJson call instead of ~97 React-managed
 * Polygon components. This survives StrictMode's double mount (the declarative <Polygon> children
 * attach to the first, discarded map instance and never appear) and restyles without re-adding
 * geometry, which is what makes hover/selection feel instant.
 */
function ProvinceGeoJsonLayer({ features, countsBySlug, maxCount, selectedSlug, onSelect, labelFor }) {
  const map = useMap();
  const layerRef = useRef(null);
  const handlersRef = useRef({ onSelect, labelFor });
  handlersRef.current = { onSelect, labelFor };

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const layer = new window.google.maps.Data({ map });
    layer.addGeoJson({ type: "FeatureCollection", features });
    layerRef.current = layer;

    const listeners = [
      layer.addListener("click", (event) => {
        const slug = event.feature.getProperty("slug");
        if (slug) handlersRef.current.onSelect(slug);
      }),
      layer.addListener("mouseover", (event) => {
        layer.overrideStyle(event.feature, { strokeWeight: 2.6, fillOpacity: 0.95 });
      }),
      layer.addListener("mouseout", () => layer.revertStyle())
    ];

    return () => {
      for (const listener of listeners) listener.remove();
      layer.setMap(null);
      layerRef.current = null;
    };
  }, [features, map]);

  // Restyle in place whenever the counts or the selection change.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    layer.setStyle((feature) => {
      const slug = feature.getProperty("slug");
      const region = feature.getProperty("region");
      const count = countsBySlug[slug] ?? 0;
      const isSelected = slug === selectedSlug;
      return {
        fillColor: provinceFill(count, maxCount, region),
        fillOpacity: count ? (isSelected ? 0.94 : 0.74) : 0.22,
        strokeColor: isSelected ? "#0b241d" : provinceStroke(region, count > 0),
        strokeOpacity: count ? (isSelected ? 1 : 0.9) : 0.35,
        strokeWeight: isSelected ? 3.4 : count ? 1.8 : 0.5,
        clickable: count > 0,
        zIndex: isSelected ? 30 : count ? 10 : 4,
        title: labelFor ? labelFor({ properties: feature.toGeoJson().properties }, count) : undefined
      };
    });
  }, [countsBySlug, labelFor, maxCount, selectedSlug]);

  return null;
}

/** Frames the current scope: a region filter or a province click re-frames the camera. */
function MapViewport({ features, selectedSlug, region }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !features.length || (!selectedSlug && !region)) return;

    const selected = selectedSlug ? features.find((feature) => feature.properties.slug === selectedSlug) : null;
    const targets = selected ? [selected] : features;
    const bounds = new window.google.maps.LatLngBounds();
    for (const feature of targets) {
      const [minLng, minLat, maxLng, maxLat] = feature.properties.bbox;
      bounds.extend({ lat: minLat, lng: minLng });
      bounds.extend({ lat: maxLat, lng: maxLng });
    }
    map.fitBounds(bounds, selected ? 80 : 24);
  }, [features, map, region, selectedSlug]);

  return null;
}

export const googleMapsAvailable = Boolean(GOOGLE_MAPS_API_KEY);

export function ProvinceMap({
  region,
  countsBySlug,
  selectedSlug,
  onSelect,
  labelFor,
  mode = "vector",
  language = "vi",
  zoomLabels,
  renderPopover
}) {
  const forceFallback = mode !== "google";
  const features = useVisibleFeatures(region);
  // Hoàng Sa is a district of Đà Nẵng and Trường Sa of Khánh Hòa — both Central provinces.
  const showIslands = !region || region === "central";
  const maxCount = useMemo(() => Math.max(1, ...Object.values(countsBySlug ?? {})), [countsBySlug]);
  // A blocked/expired Maps key must not take the page down: fall back to the SVG map instead.
  const [mapsFailed, setMapsFailed] = useState(false);
  const [deferredMount, setDeferredMount] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDeferredMount(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const selectedFeature = selectedSlug ? features.find((feature) => feature.properties.slug === selectedSlug) : null;

  if (!GOOGLE_MAPS_API_KEY || forceFallback || mapsFailed) {
    return (
      <SvgProvinceMap
        features={features}
        countsBySlug={countsBySlug}
        maxCount={maxCount}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        labelFor={labelFor}
        language={language}
        showIslands={showIslands}
        zoomLabels={zoomLabels}
        renderPopover={renderPopover}
      />
    );
  }

  // StrictMode mounts every subtree twice; @vis.gl's <Map> then binds the Google map instance to
  // the discarded container and the visible one stays empty. Mounting it in a later commit (after
  // one frame) means it mounts exactly once, which is what makes the base map appear.
  if (!deferredMount) return <div className="province-map-loading" aria-hidden="true" />;

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="beta" onError={() => setMapsFailed(true)}>
      <Map
        id="v-tnf-province-map"
        mapId={GOOGLE_MAP_ID}
        defaultCenter={MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        gestureHandling="greedy"
        clickableIcons={false}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      >
        <MapViewport features={features} selectedSlug={selectedSlug} region={region} />
        <IslandMarkers language={language} />
        <ProvinceGeoJsonLayer
          features={features}
          countsBySlug={countsBySlug}
          maxCount={maxCount}
          selectedSlug={selectedSlug}
          onSelect={onSelect}
          labelFor={labelFor}
        />
        {renderPopover && selectedFeature?.properties.center ? (
          <InfoWindow
            position={{ lat: selectedFeature.properties.center[0], lng: selectedFeature.properties.center[1] }}
            headerDisabled
            onCloseClick={() => onSelect(selectedSlug)}
          >
            <div className="map-popover is-infowindow">{renderPopover(selectedSlug)}</div>
          </InfoWindow>
        ) : null}
      </Map>
    </APIProvider>
  );
}
