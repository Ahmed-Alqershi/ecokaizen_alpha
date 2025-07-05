import { ScenarioComparison } from '../utils/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonDisplayProps {
  comparison: ScenarioComparison;
}

const ComparisonDisplay = ({ comparison }: ComparisonDisplayProps) => {
  const percentChangeData = comparison.differences.financials
    ? Object.entries(comparison.differences.financials).map(([k, v]) => ({ name: k, change: v.percentChange }))
    : [];

  const comparisonData = comparison.differences.financials
    ? Object.entries(comparison.differences.financials).map(([k, v]) => ({
        name: k,
        baseline: comparison.baseline.financials?.[k] || 0,
        scenario: comparison.scenario.financials?.[k] || 0,
      }))
    : [];

  const downloadCsv = () => {
    const rows = [
      ['Indicator', 'Baseline', 'Scenario', '% Change'],
      ...Object.entries(comparison.differences.financials || {}).map(([k, v]) => [
        k,
        (comparison.baseline.financials?.[k] || 0).toFixed(2),
        (comparison.scenario.financials?.[k] || 0).toFixed(2),
        v.percentChange.toFixed(2),
      ]),
      ['GDP', comparison.baseline.gdp.toFixed(2), comparison.scenario.gdp.toFixed(2), comparison.differences.gdp.percentChange.toFixed(2)],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'comparison.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                {Object.entries(comparison.differences.financials || {}).map(([k, v]) => (
                  <tr key={k}>
                    <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">{k}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{(comparison.baseline.financials?.[k] || 0).toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{(comparison.scenario.financials?.[k] || 0).toFixed(2)}</td>
                    <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                      v.percentChange > 0 ? 'text-success' : v.percentChange < 0 ? 'text-warning' : 'text-darkgray'
                    }`}>
                      {v.percentChange.toFixed(2)}%
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">GDP</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.baseline.gdp.toFixed(2)}</td>
                  <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{comparison.scenario.gdp.toFixed(2)}</td>
                  <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${
                    comparison.differences.gdp.percentChange > 0 ? 'text-success' : comparison.differences.gdp.percentChange < 0 ? 'text-warning' : 'text-darkgray'
                  }`}>
                    {comparison.differences.gdp.percentChange.toFixed(2)}%
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
              <BarChart data={percentChangeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="%" />
                <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                <Legend />
                <Bar dataKey="change" fill="#3b82f6" name="% Change" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {comparisonData.length > 0 && (
        <>
          <div className="mt-6">
            <h4 className="text-md font-medium mb-2">Financial Comparison</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          <div className="mt-4">
            <button onClick={downloadCsv} className="btn btn-primary">Download CSV</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ComparisonDisplay;