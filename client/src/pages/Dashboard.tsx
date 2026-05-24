import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine, Label } from 'recharts';
import API from '../api';
import { Summary, County } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape; trap Tab focus inside modal while open
  useEffect(() => {
    if (!scoreModalOpen) return;
    const modal = modalRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setScoreModalOpen(false); return; }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    // Move focus into modal on open
    modal?.querySelector<HTMLElement>('button')?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [scoreModalOpen]);

  useEffect(() => {
    Promise.all([
      API.get('/api/summary'),
      API.get('/api/counties'),
    ]).then(([s, c]) => {
      setSummary(s.data);
      setCounties(c.data);
    }).catch(() => {
      setError('Failed to load data. Make sure the Flask server is running on port 5001.');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse space-y-4 w-full">
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-red-500 font-medium mb-2">⚠ {error}</p>
        <button onClick={() => window.location.reload()} className="text-sm text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    </div>
  );

  const top10 = counties.slice(0, 10);

  const tierData = [
    { tier: 'Low (Q1)', diabetes: 14.5, obesity: 38.5, hypertension: 43.3 },
    { tier: 'Med-low (Q2)', diabetes: 16.5, obesity: 41.6, hypertension: 46.8 },
    { tier: 'Med-high (Q3)', diabetes: 17.4, obesity: 43.0, hypertension: 47.7 },
    { tier: 'High (Q4)', diabetes: 20.5, obesity: 46.8, hypertension: 51.9 },
  ];

  const driverData = counties.reduce<Record<string, number>>((acc, c) => {
    acc[c.primary_risk_driver] = (acc[c.primary_risk_driver] || 0) + 1;
    return acc;
  }, {});

  const driverChart = Object.entries(driverData)
    .map(([name, count]) => ({
      name: name.replace('High ', '').replace(' prevalence', '').replace(' vulnerability', ' vuln.'),
      count,
    }))
    .sort((a: any, b: any) => b.count - a.count);

  const scatterData = [...counties].sort((a, b) => a.poverty_rate - b.poverty_rate);

  const statCards = [
    { label: 'Total Counties', value: summary!.total_counties, sub: 'Mississippi counties analyzed', color: 'border-blue-500', text: 'text-blue-600' },
    { label: 'High-Risk Counties', value: summary!.high_risk_counties, sub: 'Dual high-risk threshold', color: 'border-red-500', text: 'text-red-600' },
    { label: 'Avg Risk Score', value: summary!.avg_risk_score, sub: 'Statewide composite average', color: 'border-amber-500', text: 'text-amber-600' },
    { label: 'Avg Poverty Rate', value: `${summary!.avg_poverty}%`, sub: 'Across all 82 counties', color: 'border-purple-500', text: 'text-purple-600' },
    { label: 'Avg Diabetes Rate', value: `${summary!.avg_diabetes}%`, sub: 'Adult prevalence statewide', color: 'border-teal-500', text: 'text-teal-600' },
    { label: 'Highest Risk County', value: summary!.top_county.county_name, sub: `Score: ${summary!.top_county.composite_risk_score}`, color: 'border-gray-400', text: 'text-gray-800' },
  ];

  return (
    <div className="space-y-8 page-transition">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
          <p className="text-gray-400 text-sm mt-1">Mississippi county-level health risk · CDC PLACES 2025 · SVI 2022</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Data last updated</p>
          <p className="text-xs font-medium text-gray-600">CDC PLACES 2025 Release</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} aria-label={`${card.label}: ${card.value}`} className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${card.color}`}>
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              {card.label}
              {card.label === 'Avg Risk Score' && (
                <button
                  onClick={e => { e.stopPropagation(); setScoreModalOpen(true); }}
                  aria-label="How is the composite risk score calculated?"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 14, height: 14, borderRadius: '50%', fontSize: 9, fontWeight: 700,
                    background: '#e5e7eb', color: '#6b7280', cursor: 'pointer',
                    border: 'none', padding: 0, flexShrink: 0, fontFamily: 'sans-serif',
                  }}
                >
                  i
                </button>
              )}
            </p>
            <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Top 10 Highest-Risk Counties</h3>
            <p className="text-xs text-gray-400 mt-0.5">Ranked by composite risk score. All are critical risk (0.75+)</p>
          </div>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={280}>
            {/* @ts-ignore */}
            <BarChart data={top10} layout="vertical" margin={{ left: 60, right: 50 }}>
              {/* @ts-ignore */}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <YAxis type="category" dataKey="county_name" tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <Tooltip formatter={(v: any) => v.toFixed(3)} />
              {/* @ts-ignore */}
              <ReferenceLine x={0.75} stroke="#9ca3af" strokeDasharray="4 4">
                {/* @ts-ignore */}
                <Label value="threshold" position="top" fontSize={10} fill="#9ca3af" />
              </ReferenceLine>
              {/* @ts-ignore */}
              <Bar dataKey="composite_risk_score" fill="#eb5757" radius={[0, 4, 4, 0]} name="Risk Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Health Outcomes by SVI Quartile</h3>
            <p className="text-xs text-gray-400 mt-0.5">All 3 indicators worsen as social vulnerability increases</p>
          </div>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={280}>
            {/* @ts-ignore */}
            <BarChart data={tierData} margin={{ left: 0, right: 10 }}>
              {/* @ts-ignore */}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <XAxis dataKey="tier" tick={{ fontSize: 10 }} />
              {/* @ts-ignore */}
              <YAxis tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <Tooltip />
              {/* @ts-ignore */}
              <Bar dataKey="diabetes" name="Diabetes %" fill="#2f80ed" radius={[4, 4, 0, 0]} />
              {/* @ts-ignore */}
              <Bar dataKey="obesity" name="Obesity %" fill="#f5a623" radius={[4, 4, 0, 0]} />
              {/* @ts-ignore */}
              <Bar dataKey="hypertension" name="Hypertension %" fill="#eb5757" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Primary Risk Driver Distribution</h3>
            <p className="text-xs text-gray-400 mt-0.5">Social vulnerability dominates across 32 of 82 counties</p>
          </div>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={280}>
            {/* @ts-ignore */}
            <BarChart data={driverChart} margin={{ left: 0, right: 10 }}>
              {/* @ts-ignore */}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              {/* @ts-ignore */}
              <YAxis tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <Tooltip />
              {/* @ts-ignore */}
              <Bar dataKey="count" name="Counties" fill="#27ae60" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">Poverty Rate vs Diabetes Rate</h3>
            <p className="text-xs text-gray-400 mt-0.5">Each dot = one Mississippi county · strong positive correlation</p>
          </div>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={260}>
            {/* @ts-ignore */}
            <ScatterChart margin={{ left: 10, right: 10, bottom: 20 }}>
              {/* @ts-ignore */}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <XAxis dataKey="poverty_rate" name="Poverty %" tick={{ fontSize: 11 }} type="number" domain={['auto', 'auto']}>
                {/* @ts-ignore */}
                <Label value="Poverty Rate (%)" offset={-10} position="insideBottom" fontSize={11} fill="#9ca3af" />
              </XAxis>
              {/* @ts-ignore */}
              <YAxis dataKey="diabetes_rate" name="Diabetes %" tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <ZAxis range={[40, 40]} />
              {/* @ts-ignore */}
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                      <p className="font-semibold">{d.county_name}</p>
                      <p>Poverty: {d.poverty_rate}%</p>
                      <p>Diabetes: {d.diabetes_rate}%</p>
                    </div>
                  );
                }}
              />
              {/* @ts-ignore */}
              <Scatter data={scatterData} fill="#2f80ed" fillOpacity={0.65} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk score methodology modal */}
      {scoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setScoreModalOpen(false)}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="methodology-modal-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setScoreModalOpen(false)}
              aria-label="Close methodology modal"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 id="methodology-modal-title" className="text-base font-bold text-gray-900 pr-8 mb-4">
              How is the Composite Risk Score Calculated?
            </h3>

            <div className="bg-gray-50 rounded-lg px-4 py-3 font-mono text-xs text-gray-700 leading-6 mb-4">
              Score = 0.25 × Diabetes + 0.20 × Obesity + 0.20 × Hypertension + 0.25 × SVI + 0.10 × COPD
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              All health indicators are min-max normalized to 0–1 before scoring. SVI is used directly
              as it is already normalized by the CDC (0 = least vulnerable, 1 = most vulnerable).
            </p>

            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-red-600 mb-1">Dual High-Risk Flag</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Counties are flagged as Dual High-Risk when they rank in the top quartile for composite
                risk score AND have an SVI score above 0.75, meaning they face the highest health
                burden with the least resources.
              </p>
            </div>

            <p className="text-xs text-gray-400">
              CDC PLACES 2025 Release · CDC/ATSDR Social Vulnerability Index 2022
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
