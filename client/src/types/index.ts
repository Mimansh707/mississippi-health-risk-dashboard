export interface County {
  fips: string;
  county_name: string;
  population: number;
  diabetes_rate: number;
  obesity_rate: number;
  hypertension_rate: number;
  copd_rate: number;
  poverty_rate: number;
  unemployment_rate: number;
  uninsured_rate: number;
  no_vehicle_rate: number;
  svi_score: number;
  composite_risk_score: number;
  risk_rank: number;
  high_risk_flag: number;
  primary_risk_driver: string;
}

export interface Summary {
  total_counties: number;
  high_risk_counties: number;
  avg_risk_score: number;
  top_county: { county_name: string; composite_risk_score: number };
  avg_diabetes: number;
  avg_poverty: number;
}
