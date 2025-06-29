import { ModelTemplate } from './types';

const templates: ModelTemplate[] = [
  {
    id: 'simple-cge',
    name: 'Simple CGE Model',
    shortDescription: 'Educational use, small-scale experiments, learning CGE fundamentals',
    type: 'simple',
    sectors: ['BRD', 'MLK'],
    factors: ['CAP', 'LAB'],
    households: ['HOH'],
    details: {
      hasGovernment: false,
      hasTrade: false,
      hasInvestment: false,
      description: 'Two goods (Bread, Milk), two production factors (Capital, Labor), one representative household'
    }
  },
  {
    id: 'standard-cge',
    name: 'Standard CGE Model',
    shortDescription: 'Policy simulations, national-level planning, intermediate users',
    type: 'standard',
    sectors: ['AGR', 'MFG', 'SVC'],
    factors: ['CAP', 'LAB', 'LAND'],
    households: ['HOH'],
    details: {
      hasGovernment: true,
      hasTrade: true,
      hasInvestment: true,
      description: 'Includes taxes, government, savings, investment, and foreign sector'
    }
  },
  {
    id: 'cameroon-cge',
    name: 'Cameroon CGE Model',
    shortDescription: 'Sectoral studies, development planning, African economies',
    type: 'cameroon',
    sectors: ['FOOD', 'AGRI', 'FORE', 'PETR', 'FOOD', 'MANU', 'CONS', 'TRAN', 'TELE', 'FSRV', 'OSRV'],
    factors: ['RULAB', 'USLAB', 'SKLAB', 'CAP'],
    households: ['RURH', 'URBH'],
    details: {
      hasGovernment: true,
      hasTrade: true,
      hasInvestment: true,
      description: 'Multi-sector (11 sectors) economy based on Cameroon\'s real data'
    }
  },
  {
    id: 'korea-cge',
    name: 'Korea CGE Model',
    shortDescription: 'Studying economic transformation, industrialization, or equity',
    type: 'korea',
    sectors: ['AGR', 'IND', 'SVC'],
    factors: ['CAP', 'LAB'],
    households: ['LABH', 'CAPH'],
    details: {
      hasGovernment: true,
      hasTrade: true,
      hasInvestment: true,
      description: 'Three sectors: agriculture, industry, and services. Two household types: labor-based and capital-based income'
    }
  }
];

export default templates;