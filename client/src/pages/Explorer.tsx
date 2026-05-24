import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { County } from '../types';

export default function Explorer() {
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [driver, setDriver] = useState('');
  const [sortBy, setSortBy] = useState('risk_rank');
  const navigate = useNavigate();

  const fetchCounties = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (riskLevel) params.append('risk_level', riskLevel);
    if (driver) params.append('driver', driver);
    API.get(`/api/counties/filter?${params.toString()}`)
      .then(r => { setCounties(r.data); setLoading(false); });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchCounties(); }, [search, riskLevel, driver]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (riskLevel) params.append('risk_level', riskLevel);
    if (driver) params.append('driver', driver);
    const baseURL = process.env.REACT_APP_API_URL || 'https://ms-health-risk-api.onrender.com';
    window.open(`${baseURL}/api/export?${params.toString()}`);
  };

  const sorted = [...counties].sort((a, b) => {
    if (sortBy === 'risk_rank') return a.risk_rank - b.risk_rank;
    if (sortBy === 'poverty_rate') return b.poverty_rate - a.poverty_rate;
    if (sortBy === 'diabetes_rate') return b.diabetes_rate - a.diabetes_rate;
    if (sortBy === 'obesity_rate') return b.obesity_rate - a.obesity_rate;
    if (sortBy === 'hypertension_rate') return b.hypertension_rate - a.hypertension_rate;
    if (sortBy === 'copd_rate') return b.copd_rate - a.copd_rate;
    return a.county_name.localeCompare(b.county_name);
  });

  const getRiskColor = (score: number) => {
    if (score >= 0.75) return 'bg-red-100 text-red-700';
    if (score >= 0.50) return 'bg-orange-100 text-orange-700';
    if (score >= 0.25) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.75) return 'Critical';
    if (score >= 0.50) return 'High';
    if (score >= 0.25) return 'Moderate';
    return 'Low';
  };

  const drivers = [
    'High social vulnerability',
    'High hypertension prevalence',
    'High COPD prevalence',
    'High obesity prevalence',
    'High diabetes prevalence',
  ];

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">County Explorer</h2>
          <p className="text-gray-500 text-sm mt-1">Search, filter, and explore all 82 Mississippi counties</p>
        </div>
        <button
          onClick={handleExport}
          aria-label="Export filtered county data as CSV"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search county..."
            aria-label="Search counties by name"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={riskLevel}
            aria-label="Filter by risk level"
            onChange={e => setRiskLevel(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All risk levels</option>
            <option value="critical">Critical (0.75+)</option>
            <option value="high">High (0.50-0.75)</option>
            <option value="moderate">Moderate (0.25-0.50)</option>
            <option value="low">Low (0-0.25)</option>
          </select>
          <select
            value={driver}
            aria-label="Filter by primary driver"
            onChange={e => setDriver(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All risk drivers</option>
            {drivers.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="risk_rank">Sort by Risk Rank</option>
            <option value="diabetes_rate">Sort by Diabetes Rate</option>
            <option value="obesity_rate">Sort by Obesity Rate</option>
            <option value="hypertension_rate">Sort by Hypertension Rate</option>
            <option value="copd_rate">Sort by COPD Rate</option>
            <option value="poverty_rate">Sort by Poverty Rate</option>
            <option value="county_name">Sort by Name</option>
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-3">{sorted.length} counties shown</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table role="table" aria-label="Mississippi county health risk data" className="w-full text-sm min-w-max">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rank</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">County</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk Score</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Risk Level</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Diabetes %</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Obesity %</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Hypertension %</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">COPD %</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Poverty %</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SVI Score</th>
              <th scope="col" className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase" style={{ minWidth: '180px' }}>Primary Driver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-8 text-gray-400">No counties match your filters</td></tr>
            ) : sorted.map(county => (
              <tr
                key={county.fips}
                onClick={() => navigate(`/county/${county.fips}`)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/county/${county.fips}`)}
                tabIndex={0}
                aria-label={`View ${county.county_name} County risk profile`}
                className="hover:bg-blue-50 cursor-pointer transition"
              >
                <th scope="row" className="px-4 py-3 text-gray-500 font-normal text-left">#{county.risk_rank}</th>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {county.county_name}
                  {county.high_risk_flag === 1 && (
                    <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">High Risk</span>
                  )}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-900">{county.composite_risk_score.toFixed(3)}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRiskColor(county.composite_risk_score)}`}>
                    {getRiskLabel(county.composite_risk_score)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{county.diabetes_rate}%</td>
                <td className="px-4 py-3 text-gray-600">{county.obesity_rate}%</td>
                <td className="px-4 py-3 text-gray-600">{county.hypertension_rate}%</td>
                <td className="px-4 py-3 text-gray-600">{county.copd_rate}%</td>
                <td className="px-4 py-3 text-gray-600">{county.poverty_rate}%</td>
                <td className="px-4 py-3 text-gray-600">{county.svi_score.toFixed(2)}</td>
                <td
                  className="px-4 py-3 text-gray-500 text-xs"
                  style={{ minWidth: '180px', maxWidth: '180px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                  title={county.primary_risk_driver}
                >{county.primary_risk_driver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
