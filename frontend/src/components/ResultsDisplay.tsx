import { ModelResults } from '../utils/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ResultsDisplayProps {
  results: ModelResults;
  title?: string;
  templateId?: string;
}

const ResultsDisplay = ({ results, title = 'Model Results', templateId }: ResultsDisplayProps) => {
  // Format data for charts
  const priceChartData = Object.entries(results.prices || {}).map(([key, value]) => ({
    name: key,
    price: value
  }));

  const productionChartData = Object.entries(results.production || {}).map(([key, value]) => ({
    name: key,
    production: value
  }));

  const financialChartData = results.financials
    ? Object.entries(results.financials).map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h4 className="text-md font-medium mb-2">Key Indicators</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-darkgray/70">GDP</p>
              <p className="text-xl font-medium">{results.gdp.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-darkgray/70">Utility</p>
              <p className="text-xl font-medium">{results.utility.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        {results.financials ? (
          <div className="card">
            <h4 className="text-md font-medium mb-2">Financial Indicators</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-midgray/30">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Item</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-midgray/30">
                  {Object.entries(results.financials).map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">{k}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{v.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <h4 className="text-md font-medium mb-2">Prices</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-midgray/30">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider">Good</th>
                    <th className="px-2 py-1 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Price</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-midgray/30">
                  {Object.entries(results.prices).map(([key, value]) => (
                    <tr key={key}>
                      <td className="px-2 py-1 whitespace-nowrap text-sm font-medium text-darkgray">{key}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">{value.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {!results.financials && (
        <>
          <div className="mt-6">
            <h4 className="text-md font-medium mb-2">Production by Sector</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productionChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="production" fill="#3b82f6" name="Production" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-md font-medium mb-2">Prices by Sector</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={priceChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="price" fill="#f97316" name="Price" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsDisplay;