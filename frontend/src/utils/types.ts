// Templates
export interface ModelTemplate {
  id: string;
  name: string;
  shortDescription: string;
  type: 'simple' | 'standard' | 'cameroon' | 'korea' | 'saudi';
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

// Model Parameters
export interface ModelParameters {
  alpha: number[]; // share parameter in utility function
  b: number[]; // scale parameter in production function
  tariff?: number[];
  indirectTax?: number[];
  incomeTax?: number[];
}

// Model Results
export interface ModelResults {
  prices: {
    [key: string]: number;
  };
  production: {
    [key: string]: number;
  };
  utility: number;
  gdp: number;
}

// Scenario Comparison
export interface ScenarioComparison {
  baseline: ModelResults;
  scenario: ModelResults;
  differences: {
    prices: {
      [key: string]: {
        value: number;
        percentChange: number;
      };
    };
    production: {
      [key: string]: {
        value: number;
        percentChange: number;
      };
    };
    utility: {
      value: number;
      percentChange: number;
    };
    gdp: {
      value: number;
      percentChange: number;
    };
  };
}