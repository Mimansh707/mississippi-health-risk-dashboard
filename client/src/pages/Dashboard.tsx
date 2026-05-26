import React, { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, ReferenceLine, Label, Cell } from 'recharts';
import API from '../api';
import { Summary, County } from '../types';

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreModalOpen,   setScoreModalOpen]   = useState(false);
  const [dualRiskModalOpen, setDualRiskModalOpen] = useState(false);
  const [sviModalOpen,     setSviModalOpen]     = useState(false);
  const modalRef         = useRef<HTMLDivElement>(null);
  const dualRiskModalRef = useRef<HTMLDivElement>(null);
  const sviModalRef      = useRef<HTMLDivElement>(null);

  // Trap keyboard focus inside the modal so Tab cycles within the dialog, not behind it
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

    // move focus in so screen readers announce the dialog immediately
    modal?.querySelector<HTMLElement>('button')?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [scoreModalOpen]);

  useEffect(() => {
    if (!dualRiskModalOpen) return;
    const modal = dualRiskModalRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDualRiskModalOpen(false); return; }
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

    modal?.querySelector<HTMLElement>('button')?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dualRiskModalOpen]);

  useEffect(() => {
    if (!sviModalOpen) return;
    const modal = sviModalRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSviModalOpen(false); return; }
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

    modal?.querySelector<HTMLElement>('button')?.focus();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sviModalOpen]);

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

  const riskDotColor = (score: number) => {
    if (score >= 0.75) return '#c0392b';
    if (score >= 0.50) return '#e67e22';
    if (score >= 0.25) return '#f1c40f';
    return '#27ae60';
  };

  const riskDotLabel = (score: number) => {
    if (score >= 0.75) return 'Critical';
    if (score >= 0.50) return 'High';
    if (score >= 0.25) return 'Moderate';
    return 'Low';
  };

  const scatterData = counties.map(c => ({
    ...c,
    fill: riskDotColor(c.composite_risk_score),
  }));

  const avgSVI = counties.length
    ? (counties.reduce((sum, c) => sum + c.svi_score, 0) / counties.length).toFixed(3)
    : '—';

  const infoBtnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 14, height: 14, borderRadius: '50%', fontSize: 9, fontWeight: 700,
    background: '#e5e7eb', color: '#6b7280', cursor: 'pointer',
    border: 'none', padding: 0, flexShrink: 0, fontFamily: 'sans-serif',
  };

  const statCards: {
    label    : string;
    value    : string | number;
    sub      : string;
    border   : string;
    text     : string;
    onInfo?  : () => void;
    infoAriaLabel?: string;
  }[] = [
    {
      label  : 'Total Counties',
      value  : summary!.total_counties,
      sub    : 'Mississippi counties analyzed',
      border : 'border-blue-500',
      text   : 'text-blue-600',
    },
    {
      label        : 'Avg Risk Score',
      value        : summary!.avg_risk_score,
      sub          : 'Statewide composite average',
      border       : 'border-amber-500',
      text         : 'text-amber-600',
      onInfo       : () => setScoreModalOpen(true),
      infoAriaLabel: 'How is the composite risk score calculated?',
    },
    {
      label        : 'Avg SVI Score',
      value        : avgSVI,
      sub          : 'Statewide social vulnerability average',
      border       : 'border-purple-500',
      text         : 'text-purple-600',
      onInfo       : () => setSviModalOpen(true),
      infoAriaLabel: 'What is the SVI Score?',
    },
    {
      label        : 'Dual High-Risk Counties',
      value        : summary!.high_risk_counties,
      sub          : 'Meet dual high-risk threshold',
      border       : 'border-red-500',
      text         : 'text-red-600',
      onInfo       : () => setDualRiskModalOpen(true),
      infoAriaLabel: 'What is a Dual High-Risk County?',
    },
    {
      label  : 'Highest Risk County',
      value  : summary!.top_county.county_name,
      sub    : `Score: ${summary!.top_county.composite_risk_score}`,
      border : 'border-gray-400',
      text   : 'text-gray-800',
    },
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            aria-label={`${card.label}: ${card.value}`}
            className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${card.border}`}
          >
            <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
              {card.label}
              {card.onInfo && (
                <button
                  onClick={e => { e.stopPropagation(); card.onInfo!(); }}
                  aria-label={card.infoAriaLabel}
                  style={infoBtnStyle}
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
            <h3 className="text-base font-semibold text-gray-900">Risk Score vs SVI Score</h3>
            <p className="text-xs text-gray-400 mt-0.5">Each dot = one Mississippi county · higher SVI means greater social vulnerability</p>
          </div>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={260}>
            {/* @ts-ignore */}
            <ScatterChart margin={{ left: 10, right: 10, bottom: 20 }}>
              {/* @ts-ignore */}
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <XAxis dataKey="svi_score" name="SVI Score" tick={{ fontSize: 11 }} type="number" domain={[0, 1]}>
                {/* @ts-ignore */}
                <Label value="SVI Score" offset={-10} position="insideBottom" fontSize={11} fill="#9ca3af" />
              </XAxis>
              {/* @ts-ignore */}
              <YAxis dataKey="composite_risk_score" name="Risk Score" tick={{ fontSize: 11 }} domain={[0, 1]} />
              {/* @ts-ignore */}
              <ZAxis range={[40, 40]} />
              {/* @ts-ignore */}
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  const level = riskDotLabel(d.composite_risk_score);
                  const levelColor = riskDotColor(d.composite_risk_score);
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg p-2 text-xs shadow">
                      <p className="font-semibold mb-1">{d.county_name}</p>
                      <p>Risk Score: {d.composite_risk_score.toFixed(3)}</p>
                      <p>SVI Score: {d.svi_score.toFixed(3)}</p>
                      <p>Risk Level: <span style={{ color: levelColor, fontWeight: 600 }}>{level}</span></p>
                    </div>
                  );
                }}
              />
              {/* @ts-ignore */}
              <Scatter data={scatterData} fillOpacity={0.8}>
                {scatterData.map((entry, index) => (
                  // @ts-ignore
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

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

      {sviModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSviModalOpen(false)}
        >
          <div
            ref={sviModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="svi-modal-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 relative overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSviModalOpen(false)}
              aria-label="Close SVI score modal"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 id="svi-modal-title" className="text-base font-bold text-gray-900 pr-8 mb-3">
              What is the SVI Score?
            </h3>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
            The Social Vulnerability Index (SVI) is a CDC metric that measures how well a community
            can cope with health emergencies based on its social and economic conditions.
            </p>

            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              How it is calculated
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              The CDC combines 16 social factors grouped into 4 themes:
            </p>

            <ol className="space-y-2 mb-4">
              {[
                { n: '1', theme: 'Socioeconomic Status',               detail: 'poverty, unemployment, no high school diploma, uninsured' },
                { n: '2', theme: 'Household Characteristics',           detail: 'age 65+, age 17 and under, disability, single-parent households' },
                { n: '3', theme: 'Racial and Ethnic Minority Status',   detail: 'minority population percentage' },
                { n: '4', theme: 'Housing and Transportation',          detail: 'multi-unit structures, mobile homes, crowding, no vehicle, group quarters' },
              ].map(({ n, theme, detail }) => (
                <li key={n} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {n}
                  </span>
                  <span><span className="font-medium text-gray-700">{theme}</span>: {detail}</span>
                </li>
              ))}
            </ol>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Each county is ranked against all US counties on all 16 factors. The rankings are
              aggregated into an overall score from 0 to 1.{' '}
              <span className="font-medium text-gray-700">0 = least vulnerable, 1 = most vulnerable.</span>
            </p>

            <p className="text-xs text-gray-400">
              Source: CDC/ATSDR Social Vulnerability Index 2022
            </p>
          </div>
        </div>
      )}

      {dualRiskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDualRiskModalOpen(false)}
        >
          <div
            ref={dualRiskModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dual-risk-modal-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setDualRiskModalOpen(false)}
              aria-label="Close dual high-risk modal"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 id="dual-risk-modal-title" className="text-base font-bold text-gray-900 pr-8 mb-4">
              What is a Dual High-Risk County?
            </h3>

            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              A county is flagged as Dual High-Risk when it meets two conditions simultaneously:
            </p>

            <ol className="space-y-3 mb-4">
              <li className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <span>Its composite risk score falls in the top quartile of all 82 Mississippi counties (score above approximately 0.65)</span>
              </li>
              <li className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <span>Its overall SVI score exceeds 0.75, indicating severe social vulnerability</span>
              </li>
            </ol>

            <div className="bg-red-50 border border-red-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                These 16 counties face the highest health burden while having the least social resources to respond.
                They represent the most urgent targets for public health intervention.
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
