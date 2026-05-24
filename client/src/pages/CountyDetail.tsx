import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import API from '../api';
import { County } from '../types';

interface AIAnalysis {
  explanation: string;
  drivers: string;
  interventions: string;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function CountyDetail() {
  const { fips } = useParams();
  const navigate = useNavigate();
  const [county, setCounty] = useState<County | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    API.get(`/api/counties/${fips}`)
      .then(r => { setCounty(r.data); setLoading(false); });
  }, [fips]);

  const getAnalysis = () => {
    setLoadingAI(true);
    setAiError(null);
    API.post('/api/explain', { fips })
      .then(r => {
        setAnalysis(r.data);
        setTimeout(() => aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      })
      .catch(err => {
        const msg = err.response?.data?.error || 'AI service unavailable. Please try again.';
        setAiError(msg);
      })
      .finally(() => { setLoadingAI(false); });
  };

  const askQuestion = () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoadingQ(true);
    API.post('/api/explain', { fips, question: q })
      .then(r => {
        setMessages(prev => [...prev, { role: 'ai', content: r.data.answer }]);
      })
      .catch(() => {
        setMessages(prev => [...prev, { role: 'ai', content: 'AI service unavailable. Please try again.' }]);
      })
      .finally(() => { setLoadingQ(false); });
  };

  const suggestedQuestions = [
    'Why is this county high risk?',
    'How does this compare to the state average?',
    'What interventions would help most?',
    'Which indicator needs the most urgent attention?',
  ];

  const getRiskColor = (score: number) => {
    if (score >= 0.75) return 'text-red-600';
    if (score >= 0.50) return 'text-orange-600';
    if (score >= 0.25) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 0.75) return 'Critical Risk';
    if (score >= 0.50) return 'High Risk';
    if (score >= 0.25) return 'Moderate Risk';
    return 'Low Risk';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 text-sm">Loading county data...</div>
    </div>
  );

  if (!county) return (
    <div className="text-center py-16 text-gray-400">County not found.</div>
  );

  const radarData = [
    { indicator: 'Diabetes', value: county.diabetes_rate, fullMark: 30 },
    { indicator: 'Obesity', value: county.obesity_rate, fullMark: 60 },
    { indicator: 'Hypertension', value: county.hypertension_rate, fullMark: 65 },
    { indicator: 'COPD', value: county.copd_rate, fullMark: 20 },
    { indicator: 'Poverty', value: county.poverty_rate, fullMark: 60 },
    { indicator: 'SVI', value: county.svi_score * 100, fullMark: 100 },
  ];

  const indicators = [
    { label: 'Diabetes Rate', value: `${county.diabetes_rate}%`, color: 'text-blue-600' },
    { label: 'Obesity Rate', value: `${county.obesity_rate}%`, color: 'text-amber-600' },
    { label: 'Hypertension Rate', value: `${county.hypertension_rate}%`, color: 'text-red-600' },
    { label: 'COPD Rate', value: `${county.copd_rate}%`, color: 'text-purple-600' },
    { label: 'Poverty Rate', value: `${county.poverty_rate}%`, color: 'text-orange-600' },
    { label: 'Uninsured Rate', value: `${county.uninsured_rate}%`, color: 'text-gray-600' },
    { label: 'Unemployment Rate', value: `${county.unemployment_rate}%`, color: 'text-gray-600' },
    { label: 'No Vehicle Access', value: `${county.no_vehicle_rate}%`, color: 'text-gray-600' },
    { label: 'SVI Score', value: county.svi_score.toFixed(3), color: 'text-teal-600' },
    { label: 'Population', value: county.population.toLocaleString(), color: 'text-gray-600' },
  ];

  return (
    <div className="space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </button>
        <button
          aria-label="Generate printable health risk report"
          onClick={() => {
            const base = `${API.defaults.baseURL}/api/report/${fips}`;
            if (analysis) {
              const params = [
                `explanation=${encodeURIComponent(analysis.explanation)}`,
                `drivers=${encodeURIComponent(analysis.drivers)}`,
                `interventions=${encodeURIComponent(analysis.interventions)}`,
              ].join('&');
              window.open(`${base}?${params}`);
            } else {
              window.open(base);
            }
          }}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 transition"
        >
          Generate Report 📄
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{county.county_name} County</h2>
            <p className="text-gray-500 text-sm mt-1">Mississippi · FIPS {county.fips} · Rank #{county.risk_rank} of 82</p>
            <p className="text-sm text-gray-500 mt-1">Primary driver: <span className="font-medium text-gray-700">{county.primary_risk_driver}</span></p>
          </div>
          <div className="text-right">
            <p className={`text-5xl font-bold ${getRiskColor(county.composite_risk_score)}`}>
              {county.composite_risk_score.toFixed(3)}
            </p>
            <p className={`text-sm font-medium mt-1 ${getRiskColor(county.composite_risk_score)}`}>
              {getRiskLabel(county.composite_risk_score)}
            </p>
            {county.high_risk_flag === 1 && (
              <span className="mt-2 inline-block text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">
                Dual High-Risk Flag
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Health and Social Indicators</h3>
          <div className="grid grid-cols-2 gap-3">
            {indicators.map(ind => (
              <div key={ind.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">{ind.label}</p>
                <p className={`text-lg font-bold ${ind.color}`}>{ind.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Risk Profile Radar</h3>
          {/* @ts-ignore */}
          <ResponsiveContainer width="100%" height={280}>
            {/* @ts-ignore */}
            <RadarChart data={radarData}>
              {/* @ts-ignore */}
              <PolarGrid stroke="#f0f0f0" />
              {/* @ts-ignore */}
              <PolarAngleAxis dataKey="indicator" tick={{ fontSize: 11 }} />
              {/* @ts-ignore */}
              <Radar name={county.county_name} dataKey="value" stroke="#eb5757" fill="#eb5757" fillOpacity={0.2} />
              {/* @ts-ignore */}
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div ref={aiSectionRef} style={{ scrollMarginTop: '80px' }} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">AI Risk Analysis</h3>
          </div>
          <button
            onClick={getAnalysis}
            disabled={loadingAI}
            aria-label="Generate AI risk analysis for this county"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loadingAI ? 'Analyzing...' : analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <span className="font-semibold">Analysis failed: </span>{aiError}
          </div>
        )}

        {analysis ? (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-600 mb-2">RISK SUMMARY</p>
              <p className="text-gray-700 text-sm leading-relaxed">{analysis.explanation}</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-600 mb-2">PRIMARY DRIVERS</p>
              <p className="text-gray-700 text-sm leading-relaxed">{analysis.drivers}</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-xs font-semibold text-green-600 mb-2">RECOMMENDED INTERVENTIONS</p>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{analysis.interventions}</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-center text-gray-400 text-sm">
            Click "Generate Analysis" to get an AI-powered breakdown of this county's health risk.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Ask the AI Analyst</h3>
        <p className="text-xs text-gray-400 mb-4">Ask any question about {county.county_name} County's health data</p>

        {messages.length === 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Suggested questions:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => setQuestion(q)}
                  className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 px-3 py-1.5 rounded-full transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div role="log" aria-live="polite" aria-label="AI analyst conversation" className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-lg rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loadingQ && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-400">
                Thinking...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && askQuestion()}
            placeholder={`Ask anything about ${county.county_name} County...`}
            aria-label="Ask a question about this county's health data"
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={askQuestion}
            disabled={loadingQ || !question.trim()}
            aria-label="Submit question"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
