// Builds src/data/vietnamProvinces.geo.json: province outlines for the 63 pre-2025 provinces,
// simplified for country-level rendering and tagged with the macro region.
//
// Source: https://github.com/daohoangson/dvhcvn (extracted from gis.chinhphu.vn).
// Run with: npm run geo:build   (needs network access; the generated file is committed)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVINCES } from "../src/shared/provinceMeta.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "src", "data", "vietnamProvinces.geo.json");
const BASE_URL = "https://raw.githubusercontent.com/daohoangson/dvhcvn/master/data/gis";
const TOLERANCE = 0.004; // ~440 m, plenty for a zoom 5-9 choropleth
const MIN_RING_AREA = 0.0004; // drop islands smaller than ~5 km²

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const simplified = points.filter((_, i) => keep[i]);
  return simplified.length >= 4 ? simplified : points;
}

function ringArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    area += (points[j][0] - points[i][0]) * (points[j][1] + points[i][1]);
  }
  return Math.abs(area / 2);
}

function roundPoint([lng, lat]) {
  return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

/** dvhcvn stores province geometry as MultiPolygon-shaped coordinates. */
function normalizePolygons(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return [];
  const looksLikePolygon = typeof coordinates[0]?.[0]?.[0] === "number";
  return looksLikePolygon ? [coordinates] : coordinates;
}

function simplifyPolygons(coordinates) {
  const polygons = [];
  for (const polygon of normalizePolygons(coordinates)) {
    const rings = [];
    for (const [ringIndex, ring] of polygon.entries()) {
      const simplified = simplifyRing(ring.map(roundPoint), TOLERANCE);
      if (ringIndex === 0 && ringArea(simplified) < MIN_RING_AREA) break;
      if (simplified.length >= 4) rings.push(simplified);
    }
    if (rings.length) polygons.push(rings);
  }
  return polygons;
}

function centroidOf(polygons) {
  let bestArea = 0;
  let best = null;
  for (const rings of polygons) {
    const area = ringArea(rings[0]);
    if (area > bestArea) {
      bestArea = area;
      best = rings[0];
    }
  }
  if (!best) return null;

  let lng = 0;
  let lat = 0;
  for (const point of best) {
    lng += point[0];
    lat += point[1];
  }
  return [Math.round((lat / best.length) * 1e5) / 1e5, Math.round((lng / best.length) * 1e5) / 1e5];
}

function bboxOf(polygons) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const rings of polygons) {
    for (const [lng, lat] of rings[0]) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return [minLng, minLat, maxLng, maxLat].map((value) => Math.round(value * 1e5) / 1e5);
}

async function fetchProvince(province) {
  const response = await fetch(`${BASE_URL}/${province.id}.json`);
  if (!response.ok) {
    throw new Error(`GIS download failed for ${province.name} (${province.id}): ${response.status}`);
  }
  const raw = await response.json();
  const polygons = simplifyPolygons(raw.coordinates);
  if (!polygons.length) throw new Error(`No usable geometry for ${province.name}`);

  return {
    type: "Feature",
    properties: {
      id: province.id,
      slug: province.slug,
      name: province.name,
      region: province.region,
      mergedInto: province.mergedInto,
      center: centroidOf(polygons),
      bbox: bboxOf(polygons)
    },
    geometry: { type: "MultiPolygon", coordinates: polygons }
  };
}

async function main() {
  const features = [];
  for (const province of PROVINCES) {
    const feature = await fetchProvince(province);
    const points = feature.geometry.coordinates.flat(2).length;
    features.push(feature);
    process.stdout.write(`${province.id} ${province.name} -> ${points} pts\n`);
  }

  const collection = { type: "FeatureCollection", generated: new Date().toISOString(), features };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(collection), "utf8");

  const { size } = await fs.stat(OUTPUT);
  process.stdout.write(`\nWrote ${features.length} provinces to ${path.relative(ROOT, OUTPUT)} (${(size / 1024).toFixed(0)} KB)\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
