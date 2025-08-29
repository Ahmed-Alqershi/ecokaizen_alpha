// Templates
export interface ModelTemplate {
  id: string;
  name: string;
  shortDescription: string;
  type: 'simple' | 'standard' | 'cameroon' | 'korea' | 'saudi' | 'mn1';
  sectors: string[];
  factors: string[];
  households: string[];
  details: {
    hasGovernment: boolean;
    hasTrade: boolean;
    hasInvestment: boolean;
    description: string;
  };
}

// SAM (Social Accounting Matrix)
export interface SAM {
  entries: string[];
  goods: string[];
  factors: string[];
  households: string[];
  data: number[][];
}

// MN1 model helpers
export interface ClosureRule {
  variable: string;
  indices: string[];
}

export interface Shock {
  target: string;
  indices: string[];
  multiplier: number;
}

// Model Parameters
export interface ModelParameters {
  alpha: number[]; // share parameter in utility function
  b: number[]; // scale parameter in production function
  tariff?: number[];
  indirectTax?: number[];
  incomeTax?: number[];
  // MN1 extensions
  prices?: number[];
  wage?: number;
  beta?: number[];
  A?: number[];
  closureRules?: ClosureRule[];
  shocks?: Shock[];
  calibration?: 'auto' | 'manual';
}

// Model Results
export interface ModelResults {
  prices?: {
    [key: string]: number;
  };
  production?: {
    [key: string]: number;
  };
  utility?: number;
  gdp?: number;
  benchmark?: {
    production: { [key: string]: number };
    prices: { [key: string]: number };
    wage: number;
    incomes: { [key: string]: number };
  };
  professional_reports?: {
    summary: { [key: string]: { [key: string]: number } };
    sector_household: { [key: string]: { [key: string]: { [key: string]: number } } };
    demand_matrix: { [key: string]: { [key: string]: { [key: string]: { [key: string]: number } } } };
  };
  financials?: {
    [key: string]: {
      value: number;
      unit?: string;
    };
  };
  omega?: number;
  y?: number;
  tothhtax?: number;
  gr?: number;
  yh?: {
    [key: string]: number;
  };
  params?: {
    tariff?: number[];
    indirectTax?: number[];
    incomeTax?: number[];
  };
}

// Scenario Comparison
export interface ScenarioComparison {
  baseline: ModelResults;
  scenario: ModelResults;
  differences: {
    prices?: {
      [key: string]: {
        value: number;
        percentChange: number;
      };
    };
    production?: {
      [key: string]: {
        value: number;
        percentChange: number;
      };
    };
    financials?: {
      [key: string]: {
        value: number;
        percentChange: number;
        unit?: string;
      };
    };
    utility?: {
      value: number;
      percentChange: number;
    };
    gdp?: {
      value: number;
      percentChange: number;
    };
    omega?: {
      value: number;
      percentChange: number;
    };
    y?: {
      value: number;
      percentChange: number;
    };
    gr?: {
      value: number;
      percentChange: number;
    };
    tothhtax?: {
      value: number;
      percentChange: number;
    };
    yh?: {
      [key: string]: {
        value: number;
        percentChange: number;
      };
    };
  };
}

// User Projects
export interface Project {
  id: number;
  name: string;
  description?: string;
  template?: string;
  status: 'open' | 'archived';
  created_at: string;
  updated_at: string;
}