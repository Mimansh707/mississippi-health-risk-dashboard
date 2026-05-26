import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Label,
} from 'recharts';
import API from '../api';
import { County } from '../types';

const INDICATORS = [
  { key: 'composite_risk_score', label: 'Risk Score',        isPercent: false },
  { key: 'diabetes_rate',        label: 'Diabetes Rate',     isPercent: true  },
  { key: 'obesity_rate',         label: 'Obesity Rate',      isPercent: true  },
  { key: 'hypertension_rate',    label: 'Hypertension Rate', isPercent: true  },
  { key: 'copd_rate',            label: 'COPD Rate',         isPercent: true  },
  { key: 'poverty_rate',         label: 'Poverty Rate',      isPercent: true  },
  { key: 'uninsured_rate',       label: 'Uninsured Rate',    isPercent: true  },
  { key: 'unemployment_rate',    label: 'Unemployment Rate', isPercent: true  },
  { key: 'svi_score',            label: 'SVI Score',         isPercent: false },
] as const;

type IndicatorKey = typeof INDICATORS[number]['key'];
type ChartType   = 'histogram' | 'bar' | 'scatter';
type ColorMode   = string; // 'risk' for risk-level coloring, or a hex color string
type FilterLevel = 'all' | 'critical' | 'high' | 'moderate' | 'low';

const RISK_COLORS: Record<string, string> = {
  Critical : '#c0392b',
  High     : '#e67e22',
  Moderate : '#f1c40f',
  Low      : '#27ae60',
};

const BLUE_600 = '#2563eb';

// left border + title color per chart type
const CHART_ACCENT: Record<ChartType, { border: string; label: string }> = {
  bar       : { border: '#3b82f6', label: 'text-blue-700'   },
  histogram : { border: '#a855f7', label: 'text-purple-700' },
  scatter   : { border: '#14b8a6', label: 'text-teal-700'   },
};

const PALETTE: string[] = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f43f5e', '#6366f1',
  '#78716c', '#64748b', '#1e293b', '#ffffff',
];

function getRiskLevel(score: number): string {
  if (score >= 0.75) return 'Critical';
  if (score >= 0.50) return 'High';
  if (score >= 0.25) return 'Moderate';
  return 'Low';
}

function countyColor(c: County, mode: ColorMode): string {
  return mode === 'risk' ? RISK_COLORS[getRiskLevel(c.composite_risk_score)] : mode;
}

function getLabel(key: IndicatorKey): string {
  return INDICATORS.find(i => i.key === key)?.label ?? key;
}

function isPct(key: IndicatorKey): boolean {
  return INDICATORS.find(i => i.key === key)?.isPercent ?? false;
}

function fmtVal(key: IndicatorKey, v: number): string {
  return isPct(key) ? `${v}%` : v.toFixed(3);
}

function getValue(county: County, key: IndicatorKey): number {
  return (county as unknown as Record<string, number>)[key];
}

// interpolates from blue-400 (#60a5fa) to blue-700 (#1d4ed8) so each bin gets darker
function histBinColor(index: number, total: number): string {
  if (total <= 1) return BLUE_600;
  const t = index / (total - 1);
  const r = Math.round(0x60 + t * (0x1d - 0x60));
  const g = Math.round(0xa5 + t * (0x4e - 0xa5));
  const b = Math.round(0xfa + t * (0xd8 - 0xfa));
  return `rgb(${r},${g},${b})`;
}

interface BinDatum {
  label : string;
  low   : number;
  high  : number;
  count : number;
}

function computeBins(counties: County[], key: IndicatorKey, numBins: number): BinDatum[] {
  if (!counties.length) return [];
  const vals = counties.map(c => getValue(c, key));
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  if (min === max) {
    return [{ label: fmtVal(key, min), low: min, high: max, count: counties.length }];
  }
  const width = (max - min) / numBins;
  const fmt   = (v: number) => isPct(key) ? v.toFixed(1) : v.toFixed(2);
  const buckets: BinDatum[] = Array.from({ length: numBins }, (_, i) => ({
    label : `${fmt(min + i * width)}–${fmt(min + (i + 1) * width)}`,
    low   : min + i * width,
    high  : min + (i + 1) * width,
    count : 0,
  }));
  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / width), numBins - 1);
    buckets[idx].count++;
  });
  return buckets;
}

const SEL =
  'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 w-full';

function HistTip({ active, payload, indKey }: any) {
  if (!active || !payload?.length) return null;
  const d: BinDatum = payload[0]?.payload;
  if (!d) return null;
  const key = indKey as IndicatorKey;
  const lo  = isPct(key) ? `${d.low.toFixed(1)}%`  : d.low.toFixed(2);
  const hi  = isPct(key) ? `${d.high.toFixed(1)}%` : d.high.toFixed(2);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-0.5">
        {d.count} {d.count === 1 ? 'county' : 'counties'}
      </p>
      <p className="text-gray-500">have {getLabel(key)} between {lo} and {hi}</p>
    </div>
  );
}

function BarTip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const level = getRiskLevel(d.risk);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.county} County</p>
      <p className="text-gray-600">
        {getLabel(metric)}: <span className="font-medium">{fmtVal(metric, d.value)}</span>
      </p>
      <p className="text-gray-600">
        Risk Level:{' '}
        <span className="font-medium" style={{ color: RISK_COLORS[level] }}>{level}</span>
      </p>
    </div>
  );
}

function ScatterTip({ active, payload, xKey, yKey }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const level = getRiskLevel(d.risk);
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-900 mb-1">{d.county} County</p>
      <p className="text-gray-600">
        {getLabel(xKey)}: <span className="font-medium">{fmtVal(xKey, d.x)}</span>
      </p>
      <p className="text-gray-600">
        {getLabel(yKey)}: <span className="font-medium">{fmtVal(yKey, d.y)}</span>
      </p>
      <p className="text-gray-600">
        Risk Level:{' '}
        <span className="font-medium" style={{ color: RISK_COLORS[level] }}>{level}</span>
      </p>
    </div>
  );
}

function ColorPalette({
  current, setter,
}: { current: ColorMode; setter: (v: ColorMode) => void }) {
  const isRisk = current === 'risk';
  return (
    <div>
      {/* Risk Level row — shows first, above the palette grid */}
      <button
        onClick={() => setter('risk')}
        className={`flex items-center gap-2 mb-2.5 px-2 py-1 rounded-lg w-full text-left transition-all ${
          isRisk ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-gray-100'
        }`}
      >
        {/* Quadrant circle: each quarter uses one of the 4 risk colors */}
        <svg width="22" height="22" viewBox="0 0 24 24" className="flex-shrink-0">
          <circle cx="12" cy="12" r="11" fill="white" />
          <path d="M 12 12 L 12 1 A 11 11 0 0 1 23 12 Z" fill="#c0392b" />
          <path d="M 12 12 L 23 12 A 11 11 0 0 1 12 23 Z" fill="#e67e22" />
          <path d="M 12 12 L 12 23 A 11 11 0 0 1 1 12 Z" fill="#f1c40f" />
          <path d="M 12 12 L 1 12 A 11 11 0 0 1 12 1 Z" fill="#27ae60" />
          <circle cx="12" cy="12" r="11" fill="none" stroke="#d1d5db" strokeWidth="1" />
        </svg>
        <span className="text-xs font-medium text-gray-700">Risk Level</span>
      </button>

      <div className="grid grid-cols-4 gap-1.5">
        {PALETTE.map(color => {
          const isSelected = current === color;
          const isWhite    = color === '#ffffff';
          return (
            <button
              key={color}
              onClick={() => setter(color)}
              title={color}
              className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{
                backgroundColor: color,
                // white circle gets a faint border so it's visible against white background
                boxShadow: isSelected
                  ? 'inset 0 0 0 2px white, 0 0 0 2px rgba(0,0,0,0.35)'
                  : isWhite
                  ? 'inset 0 0 0 1px #d1d5db'
                  : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function DataExplorer() {
  const [counties, setCounties] = useState<County[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [chartType,    setChartType]    = useState<ChartType>('bar');
  const [chartVisible, setChartVisible] = useState(true);

  const [histKey, setHistKey] = useState<IndicatorKey>('composite_risk_score');
  const [numBins, setNumBins] = useState(10);

  const [barMetric, setBarMetric] = useState<IndicatorKey>('composite_risk_score');
  const [topN,      setTopN]      = useState(10);
  const [barColor,  setBarColor]  = useState<ColorMode>('risk');

  const [xAxis,        setXAxis]        = useState<IndicatorKey>('svi_score');
  const [yAxis,        setYAxis]        = useState<IndicatorKey>('composite_risk_score');
  const [scatterColor, setScatterColor] = useState<ColorMode>('risk');
  const [filterLevel,  setFilterLevel]  = useState<FilterLevel>('all');

  useEffect(() => {
    API.get('/api/counties')
      .then(r => { setCounties(r.data); setLoading(false); })
      .catch(()  => setLoading(false));
  }, []);

  // fade out before switching so the chart transition feels smooth
  const switchChart = (type: ChartType) => {
    if (type === chartType) return;
    setChartVisible(false);
    setTimeout(() => { setChartType(type); setChartVisible(true); }, 160);
  };

  const histData = useMemo(
    () => computeBins(counties, histKey, numBins),
    [counties, histKey, numBins],
  );

  const barData = useMemo(() => {
    const sorted = [...counties].sort((a, b) => getValue(b, barMetric) - getValue(a, barMetric));
    return sorted.slice(0, topN).map(c => ({
      county : c.county_name,
      value  : getValue(c, barMetric),
      risk   : c.composite_risk_score,
      fill   : countyColor(c, barColor),
    }));
  }, [counties, barMetric, topN, barColor]);

  const filtered = useMemo(() => counties.filter(c => {
    const s = c.composite_risk_score;
    if (filterLevel === 'critical') return s >= 0.75;
    if (filterLevel === 'high')     return s >= 0.50;
    if (filterLevel === 'moderate') return s >= 0.25;
    if (filterLevel === 'low')      return s < 0.25;
    return true;
  }), [counties, filterLevel]);

  const scatterData = useMemo(() =>
    filtered.map(c => ({
      county : c.county_name,
      x      : getValue(c, xAxis),
      y      : getValue(c, yAxis),
      risk   : c.composite_risk_score,
      fill   : countyColor(c, scatterColor),
    })),
    [filtered, xAxis, yAxis, scatterColor],
  );

  const insight = useMemo(() => {
    if (chartType === 'histogram')
      return `Showing distribution of ${getLabel(histKey)} across ${counties.length} counties in ${numBins} bins`;
    if (chartType === 'bar')
      return `Top ${Math.min(topN, barData.length)} counties ranked by ${getLabel(barMetric)}`;
    return `Exploring relationship between ${getLabel(xAxis)} and ${getLabel(yAxis)} across 82 counties`;
  }, [chartType, histKey, counties.length, numBins, topN, barData.length, barMetric, xAxis, yAxis]);

  const chartTitle = useMemo(() => {
    if (chartType === 'histogram') return `Distribution of ${getLabel(histKey)}`;
    if (chartType === 'bar')       return `Top ${Math.min(topN, barData.length)} Counties · ${getLabel(barMetric)}`;
    return `${getLabel(yAxis)} vs ${getLabel(xAxis)}`;
  }, [chartType, histKey, topN, barData.length, barMetric, yAxis, xAxis]);

  const barChartHeight = Math.max(320, topN * 28 + 40);

  // reference lines only make sense when the axis uses a 0–1 scale
  const xHasThreshold = xAxis === 'composite_risk_score' || xAxis === 'svi_score';
  const yHasThreshold = yAxis === 'composite_risk_score' || yAxis === 'svi_score';

  const ScatterDot = (props: any) => {
    const { cx, cy, payload } = props;
    return (
      <circle
        cx={cx} cy={cy} r={5}
        fill={payload.fill} fillOpacity={0.85}
        stroke="#fff" strokeWidth={1.5}
      />
    );
  };

  const TypeBtn = ({
    value, label,
  }: { value: ChartType; label: string }) => (
    <button
      onClick={() => switchChart(value)}
      className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium border
        transition-all duration-150 ${
        chartType === value
          ? 'bg-blue-600 text-white border-blue-600 shadow'
          : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {label}
    </button>
  );

  const RiskLegend = () => (
    <div className="flex gap-5 flex-wrap mt-4 justify-center">
      {Object.entries(RISK_COLORS).map(([level, color]) => (
        <div key={level} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-xs text-gray-500">{level}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 page-transition">

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Data Explorer</h2>
        <p className="text-gray-500 text-sm mt-1">Build your own chart from Mississippi health data</p>
      </div>

      <div
        className="bg-gray-50 rounded-xl border border-gray-200 p-5 shadow space-y-5"
        style={{ borderTop: '4px solid #2563eb' }}
      >
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Chart Type
          </p>
          <div className="flex gap-2 flex-wrap">
            <TypeBtn value="bar"       label="Bar Chart"  />
            <TypeBtn value="histogram" label="Histogram" />
            <TypeBtn value="scatter"   label="Scatter Plot" />
          </div>
        </div>

        {chartType === 'histogram' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Select Indicator
              </label>
              <select
                value={histKey}
                onChange={e => setHistKey(e.target.value as IndicatorKey)}
                className={SEL}
              >
                {INDICATORS.map(i => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Number of bins: {numBins}
              </label>
              <input
                type="range" min={5} max={20} step={1}
                value={numBins}
                onChange={e => setNumBins(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5</span><span>20</span>
              </div>
            </div>
          </div>
        )}

        {chartType === 'bar' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Metric
              </label>
              <select
                value={barMetric}
                onChange={e => setBarMetric(e.target.value as IndicatorKey)}
                className={SEL}
              >
                {INDICATORS.map(i => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Show top {topN} counties
              </label>
              <input
                type="range" min={5} max={30} step={1}
                value={topN}
                onChange={e => setTopN(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>5</span><span>30</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Color
              </label>
              <ColorPalette current={barColor} setter={setBarColor} />
            </div>
          </div>
        )}

        {chartType === 'scatter' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                X Axis
              </label>
              <select
                value={xAxis}
                onChange={e => setXAxis(e.target.value as IndicatorKey)}
                className={SEL}
              >
                {INDICATORS.map(i => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Y Axis
              </label>
              <select
                value={yAxis}
                onChange={e => setYAxis(e.target.value as IndicatorKey)}
                className={SEL}
              >
                {INDICATORS.map(i => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Color
              </label>
              <ColorPalette current={scatterColor} setter={setScatterColor} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Filter by Risk Level
              </label>
              <select
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value as FilterLevel)}
                className={SEL}
              >
                <option value="all">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="moderate">Moderate</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div
        className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
        style={{ borderLeft: `4px solid ${CHART_ACCENT[chartType].border}` }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-80 text-gray-400 text-sm">
            Loading data…
          </div>
        ) : (
          <div
            style={{
              opacity    : chartVisible ? 1 : 0,
              transition : 'opacity 0.15s ease',
            }}
          >
            <p className={`text-base font-bold mb-4 ${CHART_ACCENT[chartType].label}`}>
              {chartTitle}
            </p>

            {chartType === 'histogram' && (
              // @ts-ignore
              <ResponsiveContainer width="100%" height={380}>
                {/* @ts-ignore */}
                <BarChart data={histData} margin={{ top: 5, right: 20, bottom: 60, left: 10 }}>
                  {/* @ts-ignore */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  {/* @ts-ignore */}
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    angle={-38}
                    textAnchor="end"
                    interval={0}
                  />
                  {/* @ts-ignore */}
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    label={{
                      value: 'Number of counties',
                      angle: -90,
                      position: 'insideLeft',
                      offset: 15,
                      fontSize: 11,
                      fill: '#6b7280',
                    }}
                    width={62}
                  />
                  {/* @ts-ignore */}
                  <Tooltip content={<HistTip indKey={histKey} />} />
                  {/* @ts-ignore */}
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Counties">
                    {histData.map((_, idx) => (
                      // @ts-ignore
                      <Cell key={`hcell-${idx}`} fill={histBinColor(idx, histData.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'bar' && (
              // @ts-ignore
              <ResponsiveContainer width="100%" height={barChartHeight}>
                {/* @ts-ignore */}
                <BarChart
                  layout="vertical"
                  data={barData}
                  margin={{ top: 5, right: 50, bottom: 5, left: 120 }}
                >
                  {/* @ts-ignore */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  {/* @ts-ignore */}
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  {/* @ts-ignore */}
                  <YAxis type="category" dataKey="county" tick={{ fontSize: 11 }} width={115} />
                  {/* @ts-ignore */}
                  <Tooltip content={<BarTip metric={barMetric} />} />
                  {/* @ts-ignore */}
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, idx) => (
                      // @ts-ignore
                      <Cell key={`cell-${idx}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {chartType === 'scatter' && (
              scatterData.length === 0 ? (
                <div className="flex items-center justify-center h-80 text-gray-400 text-sm">
                  No counties match the selected filter.
                </div>
              ) : (
                // @ts-ignore
                <ResponsiveContainer width="100%" height={420}>
                  {/* @ts-ignore */}
                  <ScatterChart margin={{ top: 10, right: 40, bottom: 40, left: 20 }}>
                    {/* @ts-ignore */}
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    {/* @ts-ignore */}
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={getLabel(xAxis)}
                      label={{
                        value: getLabel(xAxis),
                        position: 'insideBottom',
                        offset: -20,
                        fontSize: 12,
                        fill: '#6b7280',
                      }}
                      tick={{ fontSize: 11 }}
                    />
                    {/* @ts-ignore */}
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={getLabel(yAxis)}
                      label={{
                        value: getLabel(yAxis),
                        angle: -90,
                        position: 'insideLeft',
                        offset: 15,
                        fontSize: 12,
                        fill: '#6b7280',
                      }}
                      tick={{ fontSize: 11 }}
                      width={55}
                    />
                    {/* @ts-ignore */}
                    <ZAxis range={[44, 44]} />
                    {/* @ts-ignore */}
                    <Tooltip content={<ScatterTip xKey={xAxis} yKey={yAxis} />} />
                    {xHasThreshold && (
                      // @ts-ignore
                      <ReferenceLine
                        x={0.75}
                        stroke="#c0392b"
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                      >
                        {/* @ts-ignore */}
                        <Label
                          value="High risk threshold"
                          position="top"
                          fontSize={9}
                          fill="#c0392b"
                          offset={4}
                        />
                      </ReferenceLine>
                    )}
                    {yHasThreshold && (
                      // @ts-ignore
                      <ReferenceLine
                        y={0.75}
                        stroke="#c0392b"
                        strokeDasharray="5 3"
                        strokeWidth={1.5}
                      >
                        {/* @ts-ignore */}
                        <Label
                          value="0.75"
                          position="right"
                          fontSize={9}
                          fill="#c0392b"
                          offset={4}
                        />
                      </ReferenceLine>
                    )}
                    {/* @ts-ignore */}
                    <Scatter data={scatterData} shape={<ScatterDot />} />
                  </ScatterChart>
                </ResponsiveContainer>
              )
            )}

            {((chartType === 'bar'     && barColor     === 'risk') ||
              (chartType === 'scatter' && scatterColor === 'risk')) && (
              <RiskLegend />
            )}

            <p className="text-sm text-gray-400 mt-4 text-center italic">{insight}</p>
          </div>
        )}
      </div>
    </div>
  );
}
