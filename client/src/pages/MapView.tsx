import React, { useEffect, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { County } from '../types';

const GEO_URL = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const RISK_TIERS = [
  { label: 'Critical (0.75+)', color: 'bg-red-600' },
  { label: 'High (0.50–0.75)', color: 'bg-orange-500' },
  { label: 'Moderate (0.25–0.50)', color: 'bg-yellow-400' },
  { label: 'Low (0–0.25)', color: 'bg-green-500' },
];

function getRiskBadge(score: number): { label: string; bgColor: string; textColor: string } {
  if (score >= 0.75) return { label: 'Critical', bgColor: '#fde8e8', textColor: '#c0392b' };
  if (score >= 0.50) return { label: 'High',     bgColor: '#fef3e2', textColor: '#e67e22' };
  if (score >= 0.25) return { label: 'Moderate', bgColor: '#fefce8', textColor: '#b7791f' };
  return               { label: 'Low',      bgColor: '#e8f8e8', textColor: '#27ae60' };
}

function getFillColor(score: number, fips: string, highlightedFips: string | null): string {
  if (fips === highlightedFips) return '#1d4ed8';
  if (score >= 0.75) return '#c0392b';
  if (score >= 0.50) return '#e67e22';
  if (score >= 0.25) return '#f1c40f';
  return '#27ae60';
}

interface TooltipCardProps {
  county: County;
  badge: { label: string; bgColor: string; textColor: string };
}

function TooltipCard({ county, badge }: TooltipCardProps) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '10px 13px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
      minWidth: 210,
      maxWidth: 230,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 6 }}>
        {county.county_name} County
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {county.composite_risk_score.toFixed(3)}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          padding: '2px 8px',
          borderRadius: 9999,
          background: badge.bgColor,
          color: badge.textColor,
        }}>
          {badge.label}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
        {county.primary_risk_driver}
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic' }}>
        Click to view full profile
      </div>
    </div>
  );
}

export default function MapView() {
  const [counties, setCounties] = useState<County[]>([]);
  const [hoveredCounty, setHoveredCounty] = useState<County | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [pinnedCounty, setPinnedCounty] = useState<County | null>(null);
  const [search, setSearch] = useState('');
  const [highlightedFips, setHighlightedFips] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<County[]>([]);
  const [showResults, setShowResults] = useState(false);
  const justSelectedRef = useRef(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/api/counties').then(r => setCounties(r.data));
  }, []);

  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (search.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    const results = counties.filter(c =>
      c.county_name.toLowerCase().includes(search.toLowerCase())
    );
    setSearchResults(results);
    setShowResults(true);
  }, [search, counties]);

  const handleSelect = (county: County) => {
    justSelectedRef.current = true;
    setSearch(county.county_name);
    setHighlightedFips(county.fips);
    setPinnedCounty(county);
    setShowResults(false);
  };

  const handleClear = () => {
    setSearch('');
    setHighlightedFips(null);
    setPinnedCounty(null);
    setSearchResults([]);
    setShowResults(false);
  };

  const getCountyData = (fips: string) => counties.find(c => c.fips === fips);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Show the pinned tooltip only when the user isn't actively hovering, so the hover card takes priority
  const showPinnedTooltip = !hoveredCounty && pinnedCounty;

  return (
    <div className="space-y-6 page-transition">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mississippi Risk Map</h2>
        <p className="text-gray-500 text-sm mt-1">
          Hover a county to preview · Click to open its full profile · Blue = searched county
        </p>
      </div>

      <div className="relative flex-1 min-w-64 max-w-sm">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search and highlight a county..."
          aria-label="Search and highlight a county on the map"
          className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
        />
        {search && (
          <button
            onClick={handleClear}
            aria-label="Clear county search"
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        )}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {searchResults.slice(0, 6).map(c => (
              <button
                key={c.fips}
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between border-b border-gray-100 last:border-0"
              >
                <span className="font-medium text-gray-900">{c.county_name} County</span>
                <span className="text-xs text-gray-400">Rank #{c.risk_rank} · {c.composite_risk_score.toFixed(3)}</span>
              </button>
            ))}
          </div>
        )}
        {showResults && searchResults.length === 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-400">
            No counties found
          </div>
        )}
      </div>

      <div className="flex gap-5 flex-wrap">
        {RISK_TIERS.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 ${item.color}`} />
            <span className="text-xs text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>

      <div
        ref={mapContainerRef}
        role="img"
        aria-label="Interactive Mississippi county risk map. Click a county to view its health profile."
        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative"
        onMouseMove={handleMouseMove}
      >
        {/* @ts-ignore */}
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 5500, center: [-89.5, 32.75] }}
          style={{ width: '100%', height: '620px', display: 'block' }}
        >
          {/* @ts-ignore */}
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies
                .filter((geo: any) => geo.id?.startsWith('28'))
                .map((geo: any) => {
                  const data = getCountyData(geo.id);
                  const isHighlighted = geo.id === highlightedFips;
                  const fill = data
                    ? getFillColor(data.composite_risk_score, geo.id, highlightedFips)
                    : '#e5e7eb';
                  return (
                    // @ts-ignore
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fill}
                      stroke={isHighlighted ? '#1e40af' : '#ffffff'}
                      strokeWidth={isHighlighted ? 3 : 0.8}
                      style={{
                        default: { outline: 'none', cursor: 'pointer' },
                        hover:   { outline: 'none', opacity: 0.85, cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                      onMouseEnter={() => { if (data) setHoveredCounty(data); }}
                      onMouseLeave={() => setHoveredCounty(null)}
                      onClick={() => { if (data) navigate(`/county/${data.fips}`); }}
                    />
                  );
                })
            }
          </Geographies>
        </ComposableMap>

        {hoveredCounty && (() => {
          const badge = getRiskBadge(hoveredCounty.composite_risk_score);
          const tooltipWidth = 230;
          const containerWidth = mapContainerRef.current?.clientWidth ?? 800;
          const leftPos = tooltipPos.x + 18 + tooltipWidth > containerWidth
            ? tooltipPos.x - tooltipWidth - 10
            : tooltipPos.x + 18;
          return (
            <div
              style={{
                position: 'absolute',
                left: leftPos,
                top: Math.max(8, tooltipPos.y - 10),
                pointerEvents: 'none',
                zIndex: 30,
              }}
            >
              <TooltipCard county={hoveredCounty} badge={badge} />
            </div>
          );
        })()}

        {showPinnedTooltip && (() => {
          const badge = getRiskBadge(pinnedCounty!.composite_risk_score);
          return (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 30,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4, fontStyle: 'italic' }}>
                📍 Search result
              </div>
              <TooltipCard county={pinnedCounty!} badge={badge} />
            </div>
          );
        })()}

        <div className="absolute bottom-0 left-0 right-0 text-center py-1.5 text-xs text-gray-400 bg-white/80">
          Hover to preview · Click to open county profile · Blue = searched county
        </div>
      </div>
    </div>
  );
}
