import React, { useEffect, useMemo, useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import API from '../api';
import { County } from '../types';

const COLORS = ['#2f80ed', '#eb5757', '#27ae60'];

function normalize(val: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (val - min) / (max - min)));
}

function getRiskLevel(score: number): { label: string; color: string } {
  if (score >= 0.75) return { label: 'Critical', color: '#c0392b' };
  if (score >= 0.50) return { label: 'High',     color: '#e67e22' };
  if (score >= 0.25) return { label: 'Moderate', color: '#f1c40f' };
  return               { label: 'Low',      color: '#27ae60' };
}

interface SimValues {
  diabetes:     number;
  obesity:      number;
  hypertension: number;
  poverty:      number;
  copd:         number;
}

const DEFAULT_SIM: SimValues = { diabetes: 0, obesity: 0, hypertension: 0, poverty: 0, copd: 0 };

const SLIDERS: {
  key: keyof SimValues;
  label: string;
  origKey: keyof County;
  floor: number;
  stateAvg: number;
}[] = [
  { key: 'diabetes',     label: 'Diabetes Rate (%)',     origKey: 'diabetes_rate',     floor: 8,  stateAvg: 17.2 },
  { key: 'obesity',      label: 'Obesity Rate (%)',      origKey: 'obesity_rate',      floor: 20, stateAvg: 42.5 },
  { key: 'hypertension', label: 'Hypertension Rate (%)', origKey: 'hypertension_rate', floor: 30, stateAvg: 47.4 },
  { key: 'poverty',      label: 'Poverty Rate (%)',      origKey: 'poverty_rate',      floor: 5,  stateAvg: 35.0 },
  { key: 'copd',         label: 'COPD Rate (%)',         origKey: 'copd_rate',         floor: 5,  stateAvg: 9.5  },
];

export default function Compare() {
  const [allCounties, setAllCounties] = useState<County[]>([]);
  const [selected, setSelected]       = useState<string[]>(['', '', '']);
  const [data, setData]               = useState<(County | null)[]>([null, null, null]);

  const [simFips, setSimFips]       = useState('');
  const [simValues, setSimValues]   = useState<SimValues>(DEFAULT_SIM);

  useEffect(() => {
    API.get('/api/counties').then(r => setAllCounties(r.data));
  }, []);

  useEffect(() => {
    const resolved = selected.map(fips =>
      fips ? allCounties.find(c => c.fips === fips) ?? null : null
    );
    setData(resolved);
  }, [selected, allCounties]);

  // If the county being simulated is removed from the comparison, clear the sim
  useEffect(() => {
    if (simFips && !selected.includes(simFips)) {
      setSimFips('');
      setSimValues(DEFAULT_SIM);
    }
  }, [selected, simFips]);

  // Reset sliders to county's real values whenever the sim county changes
  useEffect(() => {
    if (!simFips) { setSimValues(DEFAULT_SIM); return; }
    const c = allCounties.find(ct => ct.fips === simFips);
    if (!c) return;
    setSimValues({
      diabetes:     c.diabetes_rate,
      obesity:      c.obesity_rate,
      hypertension: c.hypertension_rate,
      poverty:      c.poverty_rate,
      copd:         c.copd_rate,
    });
  }, [simFips, allCounties]);

  const handleSelect = (index: number, fips: string) => {
    const updated = [...selected];
    updated[index] = fips;
    setSelected(updated);
  };

  const activeData = data.filter(Boolean) as County[];

  // min/max bounds from the full dataset; recomputed once after initial fetch
  const norms = useMemo(() => {
    if (allCounties.length === 0) return null;
    const col = (key: keyof County) => allCounties.map(c => c[key] as number);
    const bounds = (key: keyof County) => ({
      min: Math.min(...col(key)),
      max: Math.max(...col(key)),
    });
    return {
      diabetes_rate:     bounds('diabetes_rate'),
      obesity_rate:      bounds('obesity_rate'),
      hypertension_rate: bounds('hypertension_rate'),
      copd_rate:         bounds('copd_rate'),
    };
  }, [allCounties]);

  const simCounty = activeData.find(c => c.fips === simFips) ?? null;

  // Poverty → SVI proxy: 1 % poverty reduction ≈ 0.015 SVI reduction, floor 0
  const simSVI = simCounty
    ? Math.max(0, simCounty.svi_score - (simCounty.poverty_rate - simValues.poverty) * 0.015)
    : 0;

  // Score = 0.25×diabetes_norm + 0.20×obesity_norm + 0.20×hypertension_norm + 0.25×svi + 0.10×copd_norm
  const simScore = simCounty && norms
    ? Math.max(0, Math.min(1,
        0.25 * normalize(simValues.diabetes,     norms.diabetes_rate.min,     norms.diabetes_rate.max)     +
        0.20 * normalize(simValues.obesity,      norms.obesity_rate.min,      norms.obesity_rate.max)      +
        0.20 * normalize(simValues.hypertension, norms.hypertension_rate.min, norms.hypertension_rate.max) +
        0.25 * simSVI +
        0.10 * normalize(simValues.copd,         norms.copd_rate.min,         norms.copd_rate.max)
      ))
    : 0;

  const originalScore = simCounty?.composite_risk_score ?? 0;
  const scoreDelta    = simScore - originalScore;          // negative = improvement
  const improvement   = originalScore - simScore;          // positive = improvement
  const origLevel     = getRiskLevel(originalScore);
  const simLevel      = getRiskLevel(simScore);

  const interpretation =
    improvement > 0.1
      ? `Significant risk reduction: this county could move from ${origLevel.label} to ${simLevel.label} risk.`
      : improvement >= 0.05
      ? 'Moderate improvement. Targeted interventions in these areas could meaningfully reduce risk.'
      : improvement >= 0.005
      ? 'Modest improvement. Systemic change across multiple indicators is needed.'
      : 'Adjust the sliders above to simulate the impact of health interventions.';

  const radarData = [
    { indicator: 'Diabetes',   key: 'diabetes_rate' },
    { indicator: 'Obesity',    key: 'obesity_rate' },
    { indicator: 'Hypertension', key: 'hypertension_rate' },
    { indicator: 'Poverty',    key: 'poverty_rate' },
    { indicator: 'SVI x100',   key: 'svi_score', scale: 100 },
    { indicator: 'COPD',       key: 'copd_rate' },
  ].map(item => {
    const row: any = { indicator: item.indicator };
    activeData.forEach(c => {
      const raw = (c as any)[item.key];
      row[c.county_name] = item.scale ? parseFloat((raw * item.scale).toFixed(1)) : raw;
    });
    return row;
  });

  const indicators = [
    { key: 'composite_risk_score', label: 'Risk Score',      format: (v: number) => v.toFixed(3) },
    { key: 'diabetes_rate',        label: 'Diabetes %',       format: (v: number) => `${v}%` },
    { key: 'obesity_rate',         label: 'Obesity %',        format: (v: number) => `${v}%` },
    { key: 'hypertension_rate',    label: 'Hypertension %',   format: (v: number) => `${v}%` },
    { key: 'copd_rate',            label: 'COPD %',           format: (v: number) => `${v}%` },
    { key: 'poverty_rate',         label: 'Poverty %',        format: (v: number) => `${v}%` },
    { key: 'svi_score',            label: 'SVI Score',        format: (v: number) => v.toFixed(3) },
    { key: 'uninsured_rate',       label: 'Uninsured %',      format: (v: number) => `${v}%` },
    { key: 'unemployment_rate',    label: 'Unemployment %',   format: (v: number) => `${v}%` },
    { key: 'no_vehicle_rate',      label: 'No Vehicle %',     format: (v: number) => `${v}%` },
  ];

  const getWinner = (key: string) => {
    if (activeData.length < 2) return null;
    const values = activeData.map(c => ({ name: c.county_name, val: (c as any)[key] }));
    return values.reduce((a, b) => a.val > b.val ? a : b).name;
  };

  return (
    <div className="space-y-6 page-transition">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Compare Counties</h2>
        <p className="text-gray-500 text-sm mt-1">Select up to 3 Mississippi counties to compare side by side</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl border-2 p-4 shadow-sm transition"
            style={{ borderColor: selected[i] ? COLORS[i] : '#e5e7eb' }}>
            <p className="text-xs text-gray-400 mb-2 font-medium">County {i + 1}</p>
            <select
              value={selected[i]}
              aria-label={`Select County ${i + 1}`}
              onChange={e => handleSelect(i, e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a county...</option>
              {allCounties.map(c => (
                <option key={c.fips} value={c.fips}>
                  #{c.risk_rank} {c.county_name} ({c.composite_risk_score.toFixed(3)})
                </option>
              ))}
            </select>
            {data[i] && (
              <div className="mt-3 space-y-1">
                <p className="text-3xl font-bold" style={{ color: COLORS[i] }}>
                  {data[i]!.composite_risk_score.toFixed(3)}
                </p>
                <p className="text-xs text-gray-400">Rank #{data[i]!.risk_rank} of 82</p>
                <p className="text-xs font-medium text-gray-600 mt-1">{data[i]!.primary_risk_driver}</p>
                {data[i]!.high_risk_flag === 1 && (
                  <span className="inline-block text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    High-Risk Flag
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Radar + comparison table: only when ≥ 2 counties selected */}
      {activeData.length >= 2 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Risk Profile Comparison</h3>
            <p className="text-xs text-gray-400 mb-4">Larger shape = higher values across indicators</p>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 12, fontWeight: 600, fill: '#374151' }} />
                <Tooltip formatter={(v: any) => v} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 13, paddingTop: 16 }} />
                {activeData.map((c, i) => (
                  <Radar
                    key={c.fips}
                    name={c.county_name}
                    dataKey={c.county_name}
                    stroke={COLORS[i]}
                    fill={COLORS[i]}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Side-by-Side Comparison</h3>
              <p className="text-xs text-gray-400 mt-0.5">Red = highest value for that indicator</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Indicator</th>
                  {activeData.map((c, i) => (
                    <th key={c.fips} className="text-left px-6 py-3 text-xs font-semibold uppercase"
                      style={{ color: COLORS[i] }}>
                      {c.county_name}
                    </th>
                  ))}
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Highest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {indicators.map(ind => {
                  const winner = getWinner(ind.key);
                  return (
                    <tr key={ind.key} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-600 font-medium">{ind.label}</td>
                      {activeData.map(c => {
                        const val = (c as any)[ind.key];
                        const isWinner = c.county_name === winner;
                        return (
                          <td key={c.fips}
                            className={`px-6 py-3 font-semibold ${isWinner ? 'text-red-600' : 'text-gray-700'}`}>
                            {ind.format(val)}
                          </td>
                        );
                      })}
                      <td className="px-6 py-3 text-xs font-semibold text-red-500">{winner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeData.length < 2 && (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-16 text-center">
          <p className="text-gray-400 text-sm">Select at least 2 counties above to start comparing</p>
          <p className="text-gray-300 text-xs mt-1">Try comparing Humphreys vs Lafayette to see the full range</p>
        </div>
      )}

      {/* ── What-If Simulator ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-gray-900">What-If Simulator</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Adjust health indicators to see how interventions could reduce a county's risk score
          </p>
        </div>

        {activeData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Select counties above to use the simulator.
          </p>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Simulate county
              </label>
              <select
                value={simFips}
                onChange={e => setSimFips(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              >
                <option value="">Select a county to simulate...</option>
                {activeData.map(c => (
                  <option key={c.fips} value={c.fips}>{c.county_name} County</option>
                ))}
              </select>
            </div>

            {simCounty && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Left column: sliders */}
                <div className="space-y-5">
                  {SLIDERS.map(s => {
                    const current  = simValues[s.key];
                    const original = simCounty[s.origKey] as number;
                    return (
                      <div key={s.key}>
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{s.label}</span>
                          <span className="text-sm font-bold text-blue-600">{current.toFixed(1)}%</span>
                        </div>
                        <input
                          type="range"
                          min={s.floor}
                          max={original}
                          step={0.1}
                          value={current}
                          aria-label={`Adjust ${s.label}`}
                          onChange={e =>
                            setSimValues(prev => ({ ...prev, [s.key]: parseFloat(e.target.value) }))
                          }
                          className="w-full h-2 accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                          <span>{s.floor}% min</span>
                          <span>State avg: {s.stateAvg}%</span>
                          <span>{original}% current</span>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    onClick={() =>
                      setSimValues({
                        diabetes:     simCounty.diabetes_rate,
                        obesity:      simCounty.obesity_rate,
                        hypertension: simCounty.hypertension_rate,
                        poverty:      simCounty.poverty_rate,
                        copd:         simCounty.copd_rate,
                      })
                    }
                    aria-label="Reset all sliders to original county values"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    ↺ Reset Sliders
                  </button>
                </div>

                {/* Right column: result panel */}
                <div className="space-y-4">

                  <div aria-live="polite" aria-atomic="true" className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Original Score
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-800">{originalScore.toFixed(3)}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: origLevel.color + '22', color: origLevel.color }}
                        >
                          {origLevel.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Simulated Score
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-800">{simScore.toFixed(3)}</span>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: simLevel.color + '22', color: simLevel.color }}
                        >
                          {simLevel.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Score Change
                      </span>
                      <span
                        className="text-base font-bold"
                        style={{
                          color: scoreDelta < -0.001 ? '#16a34a'
                               : scoreDelta >  0.001 ? '#dc2626'
                               : '#9ca3af',
                        }}
                      >
                        {scoreDelta > 0.001 ? '+' : ''}{scoreDelta.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-side bar */}
                  <div className="space-y-2">
                    {([
                      { label: 'Original',  score: originalScore, color: origLevel.color },
                      { label: 'Simulated', score: simScore,      color: simLevel.color  },
                    ] as const).map(row => (
                      <div key={row.label} className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="w-16 text-right shrink-0">{row.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${row.score * 100}%`, background: row.color }}
                          />
                        </div>
                        <span className="w-9 shrink-0 tabular-nums">{(row.score * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-gray-600 leading-relaxed">{interpretation}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
