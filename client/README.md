# Mississippi Health Risk Dashboard

County-level public health risk analysis for all 82 Mississippi counties. Built for the Gulf South Center Hackathon 2026.

## What it does

- Composite risk score per county (diabetes, obesity, hypertension, COPD, SVI)
- Interactive choropleth map with hover tooltips
- County explorer with filtering, sorting, and CSV export
- Side-by-side county comparison with radar chart
- What-If Simulator: adjust health indicators to model intervention outcomes
- AI-generated risk analysis and Q&A via Llama 3.3 (Groq)
- Printable PDF report per county

## Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Recharts, react-simple-maps
- **Backend**: Flask, SQLite, flask-cors
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Data**: CDC PLACES 2025, CDC/ATSDR Social Vulnerability Index 2022

## Run locally

```bash
# Backend (Python 3.10+)
cd server
pip install flask flask-cors groq
export GROQ_API_KEY=your_key_here
python app.py          # runs on :5001

# Frontend
cd client
npm install --legacy-peer-deps
npm start              # runs on :3000
```

## Risk score formula

```
Score = 0.25 × diabetes + 0.20 × obesity + 0.20 × hypertension + 0.25 × SVI + 0.10 × COPD
```

All health indicators are min-max normalized to 0–1. SVI is used directly (CDC-normalized). Counties with a score ≥ 0.75 and SVI ≥ 0.75 are flagged as Dual High-Risk.

## Data sources

- [CDC PLACES 2025](https://www.cdc.gov/places/)
- [CDC/ATSDR SVI 2022](https://www.atsdr.cdc.gov/placeandhealth/svi/)
- [Plotly GeoJSON county boundaries](https://github.com/plotly/datasets)
