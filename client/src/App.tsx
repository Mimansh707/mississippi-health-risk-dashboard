import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import DataExplorer from './pages/DataExplorer';
import CountyDetail from './pages/CountyDetail';
import MapView from './pages/MapView';
import Compare from './pages/Compare';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/explorer', label: 'County Explorer', end: true },
    { to: '/data-explorer', label: 'Data Explorer' },
    { to: '/map', label: 'Risk Map' },
    { to: '/compare', label: 'Compare Counties' },
  ];

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <nav role="navigation" aria-label="Main navigation" className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">MS</span>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900 leading-tight">MS Health Risk Dashboard</h1>
                  <p className="text-xs text-gray-400 leading-tight hidden sm:block">CDC PLACES · SVI 2022 · AI-Powered</p>
                </div>
              </div>

              <div className="hidden md:flex gap-1">
                {links.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      isActive
                        ? 'text-red-600 font-semibold text-sm px-3 py-4 border-b-2 border-red-600'
                        : 'text-gray-500 text-sm px-3 py-4 hover:text-gray-900'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>

              <button
                className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {menuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>

            {menuOpen && (
              <div id="mobile-menu" className="md:hidden border-t border-gray-100 py-2">
                {links.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      isActive
                        ? 'block px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50'
                        : 'block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/data-explorer" element={<DataExplorer />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/county/:fips" element={<CountyDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
