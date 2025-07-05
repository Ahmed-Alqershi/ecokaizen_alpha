import { ScenarioComparison } from '../utils/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonDisplayProps {
  comparison: ScenarioComparison;
}

const ComparisonDisplay = ({ comparison }: ComparisonDisplayProps) => {
  // Prepare data for the percentage change chart
  const percentChangeData = Object.entries(comparison.differences.prices).map(([key, data]) => ({
    name: key,
    price: data.percentChange,
    production: comparison.differences.production[key]?.percentChange || 0
  }));

  // Prepare data for side-by-side comparison chart
  const comparisonData = Object.entries(comparison.baseline.production).map(([key, value]) => ({
    name: key,
    baseline: value,
    scenario: comparison.scenario.production[key] || 0
  }));

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-4">Scenario Comparison</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="text-md font-medium mb-2">Key Indicators</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-midgray/30">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Indicator</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Baseline</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Scenario</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">% Change</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-midgray/30">
                <tr>
                  <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">GDP</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.baseline.gdp.toFixed(2)}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.scenario.gdp.toFixed(2)}</td>
                  <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                    comparison.differences.gdp.percentChange > 0 
                      ? 'text-success' 
                      : comparison.differences.gdp.percentChange < 0 
                        ? 'text-warning' 
                        : 'text-darkgray'
                  }`}>
                    {comparison.differences.gdp.percentChange.toFixed(2)}%
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">Utility</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.baseline.utility.toFixed(2)}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.scenario.utility.toFixed(2)}</td>
                  <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                    comparison.differences.utility.percentChange > 0 
                      ? 'text-success' 
                      : comparison.differences.utility.percentChange < 0 
                        ? 'text-warning' 
                        : 'text-darkgray'
                  }`}>
                    {comparison.differences.utility.percentChange.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="card">
          <h4 className="text-md font-medium mb-2">Percentage Changes</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={percentChangeData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <Legend />
                <Bar dataKey="price" fill="#f97316" name="Price" />
                <Bar dataKey="production" fill="#3b82f6" name="Production" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Production Comparison</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="baseline" fill="#3b82f6" name="Baseline" />
              <Bar dataKey="scenario" fill="#10b981" name="Scenario" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Detailed Changes</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-midgray/30">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Good</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Baseline Price</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Scenario Price</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Price % Change</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Baseline Prod.</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Scenario Prod.</th>
                <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Prod. % Change</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-midgray/30">
              {Object.entries(comparison.baseline.prices).map(([key, baselinePrice]) => {
                const scenarioPrice = comparison.scenario.prices[key] || 0;
                const priceChange = comparison.differences.prices[key]?.percentChange || 0;
                
                const baselineProd = comparison.baseline.production[key] || 0;
                const scenarioProd = comparison.scenario.production[key] || 0;
                const prodChange = comparison.differences.production[key]?.percentChange || 0;
                
                return (
                  <tr key={key}>
                    <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">{key}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{baselinePrice.toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{scenarioPrice.toFixed(2)}</td>
                    <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                      priceChange > 0 
                        ? 'text-success' 
                        : priceChange < 0 
                          ? 'text-warning' 
                          : 'text-darkgray'
                    }`}>
                      {priceChange.toFixed(2)}%
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{baselineProd.toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{scenarioProd.toFixed(2)}</td>
                    <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                      prodChange > 0 
                        ? 'text-success' 
                        : prodChange < 0 
                          ? 'text-warning' 
                          : 'text-darkgray'
                    }`}>
                      {prodChange.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparisonDisplay;