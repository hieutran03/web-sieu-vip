// Charts computed from the live document catalog — nothing here is hand-entered.
// The narrative underneath is rule-based; "Analyse with AI" swaps in a Gemini read-out
// generated over the very same aggregates (numbers are never model-produced).

import React, { useMemo, useState } from "react";
import { Bar, Doughnut, Line, Radar } from "react-chartjs-2";
import { api, CATEGORIES } from "../lib/documents.js";
import { buildNarrative } from "../shared/catalogStats.js";
import { categoryLabel } from "../shared/classify.js";

const PALETTE = {
  ink: "oklch(20% 0.022 176)",
  muted: "oklch(43% 0.03 176)",
  line: "oklch(72% 0.03 154 / 0.34)",
  north: "oklch(50% 0.12 235)",
  central: "oklch(66% 0.14 76)",
  south: "oklch(45% 0.13 164)",
  jade: "oklch(58% 0.13 168)",
  coral: "oklch(57% 0.16 38)",
  violet: "oklch(52% 0.16 286)"
};

/** Canvas needs a concrete color string; oklch with an alpha slash is what the app already uses. */
function withAlpha(color, alpha) {
  return color.startsWith("oklch(") ? color.replace(/\)$/, ` / ${alpha})`) : color;
}

const COVERAGE_COLORS = {
  complete: PALETTE.jade,
  "map-only": PALETTE.north,
  "geology-only": PALETTE.central,
  sparse: PALETTE.coral
};

function baseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: PALETTE.ink, font: { size: 11, weight: 700 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: "oklch(16% 0.024 176)",
        titleFont: { size: 12, weight: 700 },
        bodyFont: { size: 12 },
        padding: 10
      }
    }
  };
}

function axisOptions() {
  return {
    x: { grid: { color: PALETTE.line }, ticks: { color: PALETTE.muted, font: { size: 10, weight: 600 } } },
    y: { grid: { color: PALETTE.line }, ticks: { color: PALETTE.muted, font: { size: 10, weight: 600 }, precision: 0 }, beginAtZero: true }
  };
}

export function DocumentAnalytics({ dc, language, stats, region, provinceSlug, aiEnabled }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const narrative = useMemo(() => buildNarrative(stats, language === "en" ? "en" : "vi"), [language, stats]);

  const topProvinces = useMemo(() => stats.provinces.slice(0, 12), [stats.provinces]);

  const provinceChart = useMemo(
    () => ({
      labels: topProvinces.map((province) => province.name),
      datasets: [
        {
          label: dc.analytics.byProvince,
          data: topProvinces.map((province) => province.documentCount),
          backgroundColor: topProvinces.map((province) => PALETTE[province.region] ?? PALETTE.jade),
          borderRadius: 6,
          maxBarThickness: 26
        }
      ]
    }),
    [dc.analytics.byProvince, topProvinces]
  );

  const categoryChart = useMemo(() => {
    const entries = CATEGORIES.filter((category) => stats.byCategory[category.id]).map((category) => ({
      label: categoryLabel(category.id, language),
      value: stats.byCategory[category.id],
      color: category.color
    }));
    return {
      labels: entries.map((entry) => entry.label),
      datasets: [
        {
          data: entries.map((entry) => entry.value),
          backgroundColor: entries.map((entry) => entry.color),
          borderColor: "oklch(95.8% 0.012 112)",
          borderWidth: 3,
          hoverOffset: 8
        }
      ]
    };
  }, [language, stats.byCategory]);

  const coverageChart = useMemo(() => {
    const buckets = ["complete", "map-only", "geology-only", "sparse"];
    const regions = stats.regions;
    return {
      labels: regions.map((item) => item.name[language] ?? item.name.vi),
      datasets: buckets.map((bucket) => ({
        label: dc.coverage[bucket],
        data: regions.map((item) => stats.zones.filter((zone) => zone.region === item.id && zone.coverage === bucket).length),
        backgroundColor: COVERAGE_COLORS[bucket],
        borderRadius: 4,
        stack: "coverage"
      }))
    };
  }, [dc.coverage, language, stats.regions, stats.zones]);

  const readinessChart = useMemo(
    () => ({
      labels: [dc.provincePanel.documents, dc.provincePanel.zones, dc.coverage.complete, dc.provincePanel.provincesAxis],
      datasets: stats.regions.map((item) => {
        const maxDocuments = Math.max(1, ...stats.regions.map((entry) => entry.documentCount));
        const maxZones = Math.max(1, ...stats.regions.map((entry) => entry.zoneCount));
        const maxComplete = Math.max(1, ...stats.regions.map((entry) => entry.completeZones));
        const maxProvinces = Math.max(1, ...stats.regions.map((entry) => entry.provinceCount));
        return {
          label: item.name[language] ?? item.name.vi,
          data: [
            Math.round((item.documentCount / maxDocuments) * 100),
            Math.round((item.zoneCount / maxZones) * 100),
            Math.round((item.completeZones / maxComplete) * 100),
            Math.round((item.provinceCount / maxProvinces) * 100)
          ],
          borderColor: PALETTE[item.id],
          backgroundColor: withAlpha(PALETTE[item.id], 0.18),
          pointBackgroundColor: PALETTE[item.id],
          borderWidth: 2
        };
      })
    }),
    [dc.coverage.complete, dc.provincePanel.documents, dc.provincePanel.provincesAxis, dc.provincePanel.zones, language, stats.regions]
  );

  const yearChart = useMemo(() => {
    const years = Object.keys(stats.byYear).sort();
    return {
      labels: years,
      datasets: [
        {
          label: dc.analytics.byYear,
          data: years.map((year) => stats.byYear[year]),
          borderColor: PALETTE.violet,
          backgroundColor: withAlpha(PALETTE.violet, 0.18),
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    };
  }, [dc.analytics.byYear, stats.byYear]);

  const runAi = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.analyze({ region, province: provinceSlug, language, ai: true });
      setInsight(payload.insight);
      if (payload.insight?.aiError) setError(payload.insight.aiError);
    } catch (requestError) {
      setError(String(requestError.message ?? requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="analysis-section docs-analytics">
      <div className="analysis-intro">
        <div className="eyebrow">{dc.analytics.eyebrow}</div>
        <h2>{dc.analytics.title}</h2>
        <p>{dc.analytics.intro}</p>
      </div>

      <div className="docs-narrative">
        <div className="docs-narrative-head">
          <h3>{insight?.headline ?? dc.analytics.narrativeTitle}</h3>
          <div className="docs-narrative-actions">
            <button type="button" onClick={runAi} disabled={loading}>
              {loading ? dc.analytics.aiLoading : dc.analytics.aiButton}
            </button>
            {!aiEnabled ? <em>{dc.analytics.aiDisabled}</em> : null}
          </div>
        </div>
        <ul>
          {(insight?.bullets?.length ? insight.bullets : narrative).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {insight?.risks?.length ? (
          <div className="docs-narrative-split">
            <div>
              <h4>{dc.analytics.risks}</h4>
              <ul>
                {insight.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
            {insight.nextActions?.length ? (
              <div>
                <h4>{dc.analytics.nextActions}</h4>
                <ul>
                  {insight.nextActions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="docs-narrative-source">
          {dc.analytics.aiSource}: <code>{insight?.source ?? "rules"}</code>
          {error ? ` · ${error}` : ""}
        </p>
      </div>

      <div className="analysis-grid">
        <ChartCard title={dc.analytics.byProvince} note={dc.analytics.byProvinceNote} wide>
          <Bar data={provinceChart} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } }, scales: axisOptions() }} />
        </ChartCard>
        <ChartCard title={dc.analytics.byCategory} note={dc.analytics.byCategoryNote}>
          <Doughnut
            data={categoryChart}
            options={{ ...baseOptions(), cutout: "58%", plugins: { ...baseOptions().plugins, legend: { position: "right", labels: { color: PALETTE.ink, font: { size: 10, weight: 600 }, boxWidth: 10 } } } }}
          />
        </ChartCard>
        <ChartCard title={dc.analytics.coverage} note={dc.analytics.coverageNote}>
          <Bar
            data={coverageChart}
            options={{
              ...baseOptions(),
              scales: { x: { ...axisOptions().x, stacked: true }, y: { ...axisOptions().y, stacked: true } }
            }}
          />
        </ChartCard>
        <ChartCard title={dc.analytics.readiness} note={dc.analytics.readinessNote}>
          <Radar
            data={readinessChart}
            options={{
              ...baseOptions(),
              scales: {
                r: {
                  angleLines: { color: PALETTE.line },
                  grid: { color: PALETTE.line },
                  pointLabels: { color: PALETTE.ink, font: { size: 10, weight: 700 } },
                  suggestedMin: 0,
                  suggestedMax: 100,
                  ticks: { backdropColor: "transparent", color: PALETTE.muted, stepSize: 25 }
                }
              }
            }}
          />
        </ChartCard>
        <ChartCard title={dc.analytics.byYear} note={dc.analytics.byYearNote} wide>
          <Line data={yearChart} options={{ ...baseOptions(), plugins: { ...baseOptions().plugins, legend: { display: false } }, scales: axisOptions() }} />
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ children, note, title, wide = false }) {
  return (
    <article className={`chart-card ${wide ? "is-wide" : ""}`}>
      <div className="chart-card-head">
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className="chart-body">{children}</div>
    </article>
  );
}
