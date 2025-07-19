import { ScenarioComparison } from '../utils/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ComparisonDisplayProps {
  comparison: ScenarioComparison;
}

const ComparisonDisplay = ({ comparison }: ComparisonDisplayProps) => {
  const hasFinancials = !!comparison.differences.financials;

  type Row = { symbol: string; desc: string; baseline: number; scenario: number; change: number };
  const rows: Row[] = [];

  if (hasFinancials) {
    Object.entries(comparison.differences.financials!).forEach(([k, v]) => {
      rows.push({
        symbol: k,
        desc: k,
        baseline: comparison.baseline.financials?.[k]?.value || 0,
        scenario: comparison.scenario.financials?.[k]?.value || 0,
        change: v.percentChange,
      });
    });
    if (comparison.differences.gdp) {
      rows.push({
        symbol: 'GDP',
        desc: 'Total GDP',
        baseline: comparison.baseline.gdp || 0,
        scenario: comparison.scenario.gdp || 0,
        change: comparison.differences.gdp.percentChange,
      });
    }
  } else {
    const mapping: { key: string; desc: string }[] = [
      { key: 'omega', desc: 'Utility' },
      { key: 'utility', desc: 'Utility' },
      { key: 'y', desc: 'GDP' },
      { key: 'gdp', desc: 'GDP' },
      { key: 'gr', desc: 'Government revenue' },
    ];
    mapping.forEach(({ key, desc }) => {
      const diff: any = (comparison.differences as any)[key];
      if (diff !== undefined) {
        rows.push({
          symbol: key,
          desc,
          baseline: (comparison.baseline as any)[key] || 0,
          scenario: (comparison.scenario as any)[key] || 0,
          change: diff.percentChange,
        });
      }
    });
    if (comparison.differences.yh) {
      Object.entries(comparison.differences.yh).forEach(([hh, diff]) => {
        rows.push({
          symbol: `yh(${hh})`,
          desc: `Income for ${hh}`,
          baseline: comparison.baseline.yh?.[hh] || 0,
          scenario: comparison.scenario.yh?.[hh] || 0,
          change: diff.percentChange,
        });
      });
    }
  }

  const percentChangeData = rows.map(r => ({ name: r.symbol, change: r.change }));
  const comparisonData = rows.map(r => ({ name: r.symbol, baseline: r.baseline, scenario: r.scenario }));

  const downloadCsv = () => {
    const csvRows = [
      ['Indicator', 'Baseline', 'Scenario', '% Change'],
      ...rows.map(r => [r.symbol, r.baseline.toFixed(2), r.scenario.toFixed(2), r.change.toFixed(2)]),
    ];
    const csv = csvRows.map(r => r.join(',')).join('\n');
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
                  <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Symbol</th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Description</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Baseline</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Scenario</th>
                  <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">% Change</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-midgray/30">
                {rows.map(row => (
                  <tr key={row.symbol}>
                    <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">{row.symbol}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-darkgray">{row.desc}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{row.baseline.toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{row.scenario.toFixed(2)}</td>
                    <td className={`px-2 py-1 whitespace-nowrap text-sm text-right ${row.change > 0 ? 'text-success' : row.change < 0 ? 'text-warning' : 'text-darkgray'}`}>{row.change.toFixed(2)}%</td>
                  </tr>
                ))}
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

      {rows.length > 0 && (
        <div className="mt-4">
          <button onClick={downloadCsv} className="btn btn-primary">Download CSV</button>
        </div>
      )}
    </div>
  );
};

export default ComparisonDisplay;
