# MS Health Risk Dashboard

AI-powered public health risk analysis for all 82 Mississippi counties.

**Live App:** https://mshealthrisk.vercel.app  
**GitHub:** https://github.com/Mimansh707/mississippi-health-risk-dashboard

NOTE: If the page or data does not load when you first visit, please wait 30-50 seconds and it will appear. This is because the backend is hosted on Render's free tier, which sleeps after inactivity and takes a moment to wake up on the first request.

---

## What It Does

Analyzes county-level health and social vulnerability data across Mississippi to identify the highest-risk counties, explain what is driving their risk, and simulate the impact of public health interventions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript, Tailwind CSS v3, Recharts, react-simple-maps |
| Backend | Python Flask, SQLite |
| AI | Groq API, Llama 3.3 70B |
| Deployment | Vercel (frontend), Render (backend) |

---

## Data Sources

- CDC PLACES 2025 Release — county-level chronic disease prevalence
- CDC/ATSDR Social Vulnerability Index 2022

---

## Risk Score Formula
Score = 0.25 × Diabetes + 0.20 × Obesity + 0.20 × Hypertension + 0.25 × SVI + 0.10 × COPD
All health indicators are min-max normalized to 0-1. SVI is used directly as it is already normalized by the CDC.

---

## How to Run Locally

**Backend:**
```bash
cd server
pip install -r requirements.txt
export GROQ_API_KEY=your_key_here
python app.py
```

**Frontend:**
```bash
cd client
npm install --legacy-peer-deps
npm start
```

Frontend runs on port 3000. Backend runs on port 5001.

---

## Author

Mimansha Khadka  
MS Computer Science, University of Southern Mississippi  
Gulf South Center Hackathon 2026
