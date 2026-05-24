import sqlite3
import csv
import io
import os
import re
from contextlib import contextmanager
from html import escape
from groq import Groq
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

load_dotenv()

DB_PATH = 'ms_health.db'
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY)

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


@app.route('/api/counties', methods=['GET'])
def get_counties():
    with get_db() as conn:
        counties = conn.execute('''
            SELECT c.fips, c.county_name, c.population,
                h.diabetes_rate, h.obesity_rate,
                h.hypertension_rate, h.copd_rate,
                s.poverty_rate, s.unemployment_rate,
                s.uninsured_rate, s.no_vehicle_rate, s.svi_score,
                r.composite_risk_score, r.risk_rank,
                r.high_risk_flag, r.primary_risk_driver
            FROM counties c
            JOIN health_indicators h ON c.fips = h.fips
            JOIN social_vulnerability s ON c.fips = s.fips
            JOIN risk_scores r ON c.fips = r.fips
            ORDER BY r.risk_rank
        ''').fetchall()
    return jsonify([dict(row) for row in counties])


@app.route('/api/counties/<fips>', methods=['GET'])
def get_county(fips):
    with get_db() as conn:
        county = conn.execute('''
            SELECT c.fips, c.county_name, c.population,
                h.diabetes_rate, h.obesity_rate,
                h.hypertension_rate, h.copd_rate,
                s.poverty_rate, s.unemployment_rate,
                s.uninsured_rate, s.no_vehicle_rate, s.svi_score,
                r.composite_risk_score, r.risk_rank,
                r.high_risk_flag, r.primary_risk_driver
            FROM counties c
            JOIN health_indicators h ON c.fips = h.fips
            JOIN social_vulnerability s ON c.fips = s.fips
            JOIN risk_scores r ON c.fips = r.fips
            WHERE c.fips = ?
        ''', (fips,)).fetchone()
    if county is None:
        return jsonify({'error': 'County not found'}), 404
    return jsonify(dict(county))


@app.route('/api/counties/filter', methods=['GET'])
def filter_counties():
    risk_level = request.args.get('risk_level')
    min_poverty = request.args.get('min_poverty', 0, type=float)
    max_poverty = request.args.get('max_poverty', 100, type=float)
    driver = request.args.get('driver')
    search = request.args.get('search', '')

    query = '''
        SELECT c.fips, c.county_name, c.population,
            h.diabetes_rate, h.obesity_rate,
            h.hypertension_rate, h.copd_rate,
            s.poverty_rate, s.unemployment_rate,
            s.uninsured_rate, s.no_vehicle_rate, s.svi_score,
            r.composite_risk_score, r.risk_rank,
            r.high_risk_flag, r.primary_risk_driver
        FROM counties c
        JOIN health_indicators h ON c.fips = h.fips
        JOIN social_vulnerability s ON c.fips = s.fips
        JOIN risk_scores r ON c.fips = r.fips
        WHERE s.poverty_rate BETWEEN ? AND ?
        AND c.county_name LIKE ?
    '''
    params = [min_poverty, max_poverty, f'%{search}%']

    if risk_level == 'critical':
        query += ' AND r.composite_risk_score >= 0.75'
    elif risk_level == 'high':
        query += ' AND r.composite_risk_score >= 0.50 AND r.composite_risk_score < 0.75'
    elif risk_level == 'moderate':
        query += ' AND r.composite_risk_score >= 0.25 AND r.composite_risk_score < 0.50'
    elif risk_level == 'low':
        query += ' AND r.composite_risk_score < 0.25'

    if driver:
        query += ' AND r.primary_risk_driver = ?'
        params.append(driver)

    query += ' ORDER BY r.risk_rank'

    with get_db() as conn:
        counties = conn.execute(query, params).fetchall()
    return jsonify([dict(row) for row in counties])


@app.route('/api/summary', methods=['GET'])
def get_summary():
    with get_db() as conn:
        total = conn.execute('SELECT COUNT(*) FROM counties').fetchone()[0]
        high_risk = conn.execute('SELECT COUNT(*) FROM risk_scores WHERE high_risk_flag = 1').fetchone()[0]
        avg_score = conn.execute('SELECT ROUND(AVG(composite_risk_score), 3) FROM risk_scores').fetchone()[0]
        top_county = conn.execute('''
            SELECT c.county_name, r.composite_risk_score
            FROM counties c JOIN risk_scores r ON c.fips = r.fips
            ORDER BY r.risk_rank LIMIT 1
        ''').fetchone()
        avg_diabetes = conn.execute('SELECT ROUND(AVG(diabetes_rate), 1) FROM health_indicators').fetchone()[0]
        avg_poverty = conn.execute('SELECT ROUND(AVG(poverty_rate), 1) FROM social_vulnerability').fetchone()[0]
    return jsonify({
        'total_counties': total,
        'high_risk_counties': high_risk,
        'avg_risk_score': avg_score,
        'top_county': dict(top_county),
        'avg_diabetes': avg_diabetes,
        'avg_poverty': avg_poverty,
    })


@app.route('/api/explain', methods=['POST'])
def explain_county():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request must be JSON'}), 400
    fips = data.get('fips')
    if not fips:
        return jsonify({'error': 'fips is required'}), 400
    question = data.get('question', '')

    with get_db() as conn:
        county = conn.execute('''
            SELECT c.county_name, c.population,
                h.diabetes_rate, h.obesity_rate,
                h.hypertension_rate, h.copd_rate,
                s.poverty_rate, s.svi_score,
                s.uninsured_rate, s.unemployment_rate,
                r.composite_risk_score, r.risk_rank,
                r.high_risk_flag, r.primary_risk_driver
            FROM counties c
            JOIN health_indicators h ON c.fips = h.fips
            JOIN social_vulnerability s ON c.fips = s.fips
            JOIN risk_scores r ON c.fips = r.fips
            WHERE c.fips = ?
        ''', (fips,)).fetchone()

        summary = conn.execute('''
            SELECT ROUND(AVG(h.diabetes_rate),1),
                   ROUND(AVG(s.poverty_rate),1),
                   ROUND(AVG(r.composite_risk_score),3)
            FROM health_indicators h
            JOIN social_vulnerability s ON h.fips = s.fips
            JOIN risk_scores r ON h.fips = r.fips
        ''').fetchone()

    if county is None:
        return jsonify({'error': 'County not found'}), 404

    county = dict(county)

    context = f"""
You are a senior public health analyst advising Mississippi health officials.
You have the following verified CDC data for {county['county_name']} County, Mississippi:

- Composite risk score: {county['composite_risk_score']} out of 1.0 (ranked #{county['risk_rank']} of 82 counties)
- Primary risk driver: {county['primary_risk_driver']}
- Diabetes rate: {county['diabetes_rate']}%
- Obesity rate: {county['obesity_rate']}%
- Hypertension rate: {county['hypertension_rate']}%
- COPD rate: {county['copd_rate']}%
- Poverty rate: {county['poverty_rate']}%
- Uninsured rate: {county['uninsured_rate']}%
- Unemployment rate: {county['unemployment_rate']}%
- Social vulnerability score: {county['svi_score']} out of 1.0
- High risk flag: {'Yes' if county['high_risk_flag'] else 'No'}
- Population: {county['population']:,}

Mississippi state averages for context:
- Average diabetes rate: {summary[0]}%
- Average poverty rate: {summary[1]}%
- Average risk score: {summary[2]}
"""

    if question:
        prompt = f"{context}\n\nA public health professional asks: {question}\n\nAnswer in 2-4 sentences. Be specific and reference the actual data above. Keep it clear and non-technical."
    else:
        prompt = f"""{context}

Respond in exactly this format with no extra text:

EXPLANATION:
2-3 sentences explaining this county's health risk in plain English for a non-technical audience.

DRIVERS:
1 sentence identifying the top factors driving this county's risk.

INTERVENTIONS:
1. First specific public health intervention tailored to this county's primary driver
2. Second intervention focused on social vulnerability factors
3. Third intervention focused on healthcare access given the uninsured rate"""

    try:
        response = groq_client.chat.completions.create(
            model='llama-3.3-70b-versatile',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=600,
            temperature=0.3,
        )
        text = response.choices[0].message.content
    except Exception as e:
        return jsonify({'error': f'AI service unavailable: {str(e)}'}), 503

    if question:
        return jsonify({'answer': text})

    sections = {'explanation': '', 'drivers': '', 'interventions': ''}
    current = None
    for line in text.split('\n'):
        stripped = line.strip()
        upper = stripped.upper().rstrip(':')
        if upper == 'EXPLANATION':
            current = 'explanation'
        elif upper == 'DRIVERS':
            current = 'drivers'
        elif upper == 'INTERVENTIONS':
            current = 'interventions'
        elif stripped and current:
            sections[current] += stripped + ' '

    if not any(sections.values()):
        sections['explanation'] = text.strip()

    return jsonify({
        'explanation': sections['explanation'].strip(),
        'drivers': sections['drivers'].strip(),
        'interventions': sections['interventions'].strip(),
    })


@app.route('/api/export', methods=['GET'])
def export_csv():
    risk_level = request.args.get('risk_level')
    search = request.args.get('search', '')
    driver = request.args.get('driver')
    min_poverty = request.args.get('min_poverty', 0, type=float)
    max_poverty = request.args.get('max_poverty', 100, type=float)

    query = '''
        SELECT c.county_name, c.population,
            h.diabetes_rate, h.obesity_rate,
            h.hypertension_rate, h.copd_rate,
            s.poverty_rate, s.svi_score,
            s.uninsured_rate, s.unemployment_rate,
            r.composite_risk_score, r.risk_rank,
            r.primary_risk_driver
        FROM counties c
        JOIN health_indicators h ON c.fips = h.fips
        JOIN social_vulnerability s ON c.fips = s.fips
        JOIN risk_scores r ON c.fips = r.fips
        WHERE s.poverty_rate BETWEEN ? AND ?
        AND c.county_name LIKE ?
    '''
    params = [min_poverty, max_poverty, f'%{search}%']

    if risk_level == 'critical':
        query += ' AND r.composite_risk_score >= 0.75'
    elif risk_level == 'high':
        query += ' AND r.composite_risk_score >= 0.50 AND r.composite_risk_score < 0.75'
    elif risk_level == 'moderate':
        query += ' AND r.composite_risk_score >= 0.25 AND r.composite_risk_score < 0.50'
    elif risk_level == 'low':
        query += ' AND r.composite_risk_score < 0.25'

    if driver:
        query += ' AND r.primary_risk_driver = ?'
        params.append(driver)

    query += ' ORDER BY r.risk_rank'

    with get_db() as conn:
        rows = conn.execute(query, params).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['County', 'Population', 'Diabetes %', 'Obesity %',
                     'Hypertension %', 'COPD %', 'Poverty %', 'SVI Score',
                     'Uninsured %', 'Unemployment %', 'Risk Score',
                     'Risk Rank', 'Primary Driver'])
    for row in rows:
        writer.writerow(list(row))

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=mississippi_health_risk.csv'}
    )


@app.route('/api/report/<fips>', methods=['GET'])
def generate_report(fips):
    explanation  = escape(request.args.get('explanation',  '').strip())
    drivers      = escape(request.args.get('drivers',      '').strip())
    interventions = escape(request.args.get('interventions', '').strip())
    has_ai = bool(explanation and drivers and interventions)

    with get_db() as conn:
        county = conn.execute('''
            SELECT c.fips, c.county_name, c.population,
                h.diabetes_rate, h.obesity_rate,
                h.hypertension_rate, h.copd_rate,
                s.poverty_rate, s.unemployment_rate,
                s.uninsured_rate, s.no_vehicle_rate, s.svi_score,
                r.composite_risk_score, r.risk_rank,
                r.high_risk_flag, r.primary_risk_driver
            FROM counties c
            JOIN health_indicators h ON c.fips = h.fips
            JOIN social_vulnerability s ON c.fips = s.fips
            JOIN risk_scores r ON c.fips = r.fips
            WHERE c.fips = ?
        ''', (fips,)).fetchone()

    if county is None:
        return "County not found", 404

    c = dict(county)
    risk_label = "Critical Risk" if c['composite_risk_score'] >= 0.75 else \
                 "High Risk" if c['composite_risk_score'] >= 0.50 else \
                 "Moderate Risk" if c['composite_risk_score'] >= 0.25 else "Low Risk"
    risk_color = "#c0392b" if c['composite_risk_score'] >= 0.75 else \
                 "#e67e22" if c['composite_risk_score'] >= 0.50 else \
                 "#f1c40f" if c['composite_risk_score'] >= 0.25 else "#27ae60"

    if has_ai:
        ai_section = f"""<div class="section">
  <div class="section-title">AI Analysis (Llama 3.3 via Groq)</div>
  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:16px;margin-bottom:12px;">
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:#0284c7;font-family:sans-serif;font-weight:600;margin-bottom:8px;">Risk Summary</div>
    <div style="font-size:0.88rem;color:#374151;line-height:1.7;">{explanation}</div>
  </div>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:16px;margin-bottom:12px;">
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:#d97706;font-family:sans-serif;font-weight:600;margin-bottom:8px;">Primary Drivers</div>
    <div style="font-size:0.88rem;color:#374151;line-height:1.7;">{drivers}</div>
  </div>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;">
    <div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:#16a34a;font-family:sans-serif;font-weight:600;margin-bottom:8px;">Recommended Interventions</div>
    <div style="font-size:0.88rem;color:#374151;line-height:1.7;white-space:pre-line;">{interventions}</div>
  </div>
</div>
"""
    else:
        ai_section = ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{c['county_name']} County Health Risk Report</title>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family:'Georgia',serif; color:#1a1a1a; background:white; padding:48px; max-width:800px; margin:0 auto; }}
  .header {{ border-bottom:3px solid #1a1a1a; padding-bottom:24px; margin-bottom:32px; }}
  .header-top {{ display:flex; justify-content:space-between; align-items:flex-start; }}
  .report-label {{ font-size:10px; text-transform:uppercase; letter-spacing:0.15em; color:#666; margin-bottom:8px; font-family:sans-serif; }}
  .county-name {{ font-size:2.2rem; font-weight:bold; margin-bottom:4px; }}
  .county-meta {{ font-size:0.85rem; color:#555; font-family:sans-serif; }}
  .score-box {{ text-align:right; }}
  .score-num {{ font-size:3rem; font-weight:bold; color:{risk_color}; line-height:1; }}
  .score-label {{ font-size:0.8rem; color:{risk_color}; font-family:sans-serif; font-weight:600; margin-top:4px; }}
  .high-risk-badge {{ display:inline-block; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:3px 10px; border-radius:4px; font-size:0.75rem; font-family:sans-serif; font-weight:600; margin-top:6px; }}
  .section {{ margin-bottom:32px; }}
  .section-title {{ font-size:0.7rem; text-transform:uppercase; letter-spacing:0.12em; color:#888; font-family:sans-serif; font-weight:600; margin-bottom:16px; padding-bottom:6px; border-bottom:1px solid #e5e7eb; }}
  .indicators {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }}
  .indicator {{ background:#f9fafb; border:1px solid #e5e7eb; padding:12px 16px; border-radius:6px; }}
  .ind-label {{ font-size:0.72rem; color:#888; font-family:sans-serif; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.05em; }}
  .ind-value {{ font-size:1.4rem; font-weight:bold; font-family:sans-serif; color:#1a1a1a; }}
  .score-bar {{ margin-top:6px; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden; }}
  .score-fill {{ height:100%; border-radius:3px; background:{risk_color}; width:{int(c['composite_risk_score']*100)}%; }}
  .formula {{ background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:16px; font-family:monospace; font-size:0.82rem; color:#374151; line-height:2; }}
  .footer {{ margin-top:48px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:0.72rem; color:#999; font-family:sans-serif; display:flex; justify-content:space-between; }}
  @media print {{ .no-print {{ display:none; }} }}
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div>
      <div class="report-label">Mississippi County Health Risk Report</div>
      <div class="county-name">{c['county_name']} County</div>
      <div class="county-meta">FIPS {c['fips']} · Rank #{c['risk_rank']} of 82 · Population {c['population']:,}</div>
      <div class="county-meta" style="margin-top:4px;">Primary Risk Driver: <strong>{c['primary_risk_driver']}</strong></div>
      {('<div class="high-risk-badge">⚠ Dual High-Risk Flag</div>' if c['high_risk_flag'] else '')}
    </div>
    <div class="score-box">
      <div class="report-label">Composite Risk Score</div>
      <div class="score-num">{c['composite_risk_score']:.3f}</div>
      <div class="score-label">{risk_label}</div>
      <div class="score-bar" style="margin-top:8px;width:120px;margin-left:auto;"><div class="score-fill"></div></div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Health Indicators (CDC PLACES 2025)</div>
  <div class="indicators">
    <div class="indicator"><div class="ind-label">Diabetes Rate</div><div class="ind-value">{c['diabetes_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">Obesity Rate</div><div class="ind-value">{c['obesity_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">Hypertension Rate</div><div class="ind-value">{c['hypertension_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">COPD Rate</div><div class="ind-value">{c['copd_rate']}%</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Social Vulnerability (CDC SVI 2022)</div>
  <div class="indicators">
    <div class="indicator"><div class="ind-label">Poverty Rate</div><div class="ind-value">{c['poverty_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">Uninsured Rate</div><div class="ind-value">{c['uninsured_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">Unemployment Rate</div><div class="ind-value">{c['unemployment_rate']}%</div></div>
    <div class="indicator"><div class="ind-label">No Vehicle Access</div><div class="ind-value">{c['no_vehicle_rate']}%</div></div>
    <div class="indicator" style="grid-column:span 2;"><div class="ind-label">Overall SVI Score (0=least vulnerable, 1=most vulnerable)</div><div class="ind-value">{c['svi_score']:.3f}</div></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Risk Score Methodology</div>
  <div class="formula">Score = 0.25 × Diabetes + 0.20 × Obesity + 0.20 × Hypertension + 0.25 × SVI + 0.10 × COPD
All health indicators min-max normalized to 0-1. SVI used directly (already normalized by CDC).</div>
</div>

<div class="section">
  <div class="section-title">State Context</div>
  <div class="indicators">
    <div class="indicator"><div class="ind-label">MS Avg Diabetes Rate</div><div class="ind-value">17.2%</div></div>
    <div class="indicator"><div class="ind-label">MS Avg Poverty Rate</div><div class="ind-value">35.0%</div></div>
    <div class="indicator"><div class="ind-label">MS Avg Risk Score</div><div class="ind-value">0.488</div></div>
    <div class="indicator"><div class="ind-label">This County vs State Average</div><div class="ind-value" style="color:{risk_color};">{'+' if c['composite_risk_score'] > 0.488 else ''}{(c['composite_risk_score']-0.488):.3f}</div></div>
  </div>
</div>

{ai_section}
<div class="footer">
  <span>Data: CDC PLACES 2025 · CDC/ATSDR SVI 2022</span>
  <span>Mississippi Health Risk Dashboard · Gulf South Center Hackathon 2026</span>
</div>

<div class="no-print" style="text-align:center;margin-top:32px;">
  <button onclick="window.print()" style="background:#1d4ed8;color:white;border:none;padding:12px 32px;border-radius:8px;font-size:1rem;cursor:pointer;font-family:sans-serif;">Print / Save as PDF</button>
</div>
</body>
</html>"""
    return html


if __name__ == '__main__':
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(debug=debug, port=5001)
