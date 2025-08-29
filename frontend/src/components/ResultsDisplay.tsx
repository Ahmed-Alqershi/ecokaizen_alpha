import { ModelResults } from '../utils/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ResultsDisplayProps {
  results: ModelResults;
  title?: string;
  templateId?: string;
}

const ResultsDisplay = ({ results, title = 'Model Results', templateId }: ResultsDisplayProps) => {
  const summaryOnly = templateId === 'saudi-cge' || templateId === 'korea-cge';
  const hasProfessionalReports = !!results.professional_reports;
  // Format data for charts
  const priceChartData = Object.entries(results.prices || {}).map(
    ([key, value]) => ({
      name: key,
      price: value
    })
  );

  const productionChartData = Object.entries(results.production || {}).map(
    ([key, value]) => ({
      name: key,
      production: value
    })
  );

  const financialChartData = results.financials
    ? Object.entries(results.financials).map(([k, v]) => ({ name: k, value: v.value }))
    : [];

  const indicators: { label: string; value: number }[] = [];
  if (typeof results.gdp === 'number') {
    indicators.push({ label: 'GDP', value: results.gdp });
  } else if (typeof results.y === 'number') {
    indicators.push({ label: 'GDP', value: results.y });
  }
  if (typeof results.utility === 'number') {
    indicators.push({ label: 'Utility', value: results.utility });
  } else if (typeof results.omega === 'number') {
    indicators.push({ label: 'Utility', value: results.omega });
  }
  if (results.benchmark?.wage && typeof results.benchmark.wage === 'number') {
    indicators.push({ label: 'Wage Rate', value: results.benchmark.wage });
  }

  const showFinancialCard = !!results.financials && !summaryOnly && !hasProfessionalReports;
  const showPricesCard =
    !results.financials && Object.keys(results.prices || {}).length > 0 && !summaryOnly && !hasProfessionalReports;
  const showProductionCard = Object.keys(results.production || {}).length > 0 && !hasProfessionalReports;
  const gridColsClass = (showFinancialCard || showPricesCard) && !hasProfessionalReports ? 'md:grid-cols-2' : 'md:grid-cols-1';

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <h3 className="text-lg font-medium mb-4">{title}</h3>

      {/* Show Professional Reports if available, otherwise show old structure */}
      {hasProfessionalReports ? (
        // Professional Reports Section
        <div className="space-y-6">
          {/* Summary Report */}
          {results.professional_reports?.summary && (
            <div>
              <h4 className="text-lg font-medium mb-4 text-blue-600">Summary Report</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-midgray/30 border border-midgray/30 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Indicator</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Benchmark</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">After Shock</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Change (%)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-midgray/30">
                    {Object.entries(results.professional_reports.summary).map(([indicator, data]) => (
                      <tr key={indicator} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-darkgray border-r border-midgray/30">{indicator}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                          {typeof data['Benchmark'] === 'number' ? data['Benchmark'].toFixed(4) : 'N/A'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                          {typeof data['After Shock'] === 'number' ? data['After Shock'].toFixed(4) : 'N/A'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-darkgray">
                          {typeof data['Change (%)'] === 'number' ? data['Change (%)'].toFixed(2) + '%' : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sector and Household Report */}
          {results.professional_reports?.sector_household && (
            <div>
              <h4 className="text-lg font-medium mb-4 text-green-600">Sector & Household Report</h4>
              {Object.entries(results.professional_reports.sector_household).map(([category, categoryData]) => (
                <div key={category} className="mb-6">
                  <h5 className="text-md font-medium mb-3 text-darkgray/80">{category}</h5>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-midgray/30 border border-midgray/30 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Item</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Benchmark</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">After Shock</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Change (%)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-midgray/30">
                        {Object.entries(categoryData).map(([item, itemData]) => (
                          <tr key={item} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-darkgray border-r border-midgray/30">{item}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                              {typeof itemData['Benchmark'] === 'number' ? itemData['Benchmark'].toFixed(4) : 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                              {typeof itemData['After Shock'] === 'number' ? itemData['After Shock'].toFixed(4) : 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray">
                              {typeof itemData['Change (%)'] === 'number' ? itemData['Change (%)'].toFixed(2) + '%' : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Demand Matrix Report */}
          {results.professional_reports?.demand_matrix && (
            <div>
              <h4 className="text-lg font-medium mb-4 text-purple-600">Demand Matrix Report</h4>
              {Object.entries(results.professional_reports.demand_matrix).map(([category, categoryData]) => (
                <div key={category} className="mb-6">
                  <h5 className="text-md font-medium mb-3 text-darkgray/80">{category}</h5>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-midgray/30 border border-midgray/30 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Consumer</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Sector</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">Benchmark</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider border-r border-midgray/30">After Shock</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-darkgray/70 uppercase tracking-wider">Change (%)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-midgray/30">
                        {Object.entries(categoryData).map(([consumer, consumerData]) =>
                          Object.entries(consumerData).map(([sector, sectorData]) => (
                            <tr key={`${consumer}-${sector}`} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-darkgray border-r border-midgray/30">{consumer}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-darkgray border-r border-midgray/30">{sector}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                                {typeof sectorData['Benchmark'] === 'number' ? sectorData['Benchmark'].toFixed(4) : 'N/A'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray border-r border-midgray/30">
                                {typeof sectorData['After Shock'] === 'number' ? sectorData['After Shock'].toFixed(4) : 'N/A'}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-darkgray">
                                {typeof sectorData['Change (%)'] === 'number' ? sectorData['Change (%)'].toFixed(2) + '%' : 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Old Results Structure (only shown when no professional reports)
        <div className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
          {indicators.length > 0 && (
            <div className="card">
              <h4 className="text-md font-medium mb-2">Key Indicators</h4>
              <div className="grid grid-cols-2 gap-4">
                {indicators.map(ind => (
                  <div key={ind.label}>
                    <p className="text-sm text-darkgray/70">{ind.label}</p>
                    <p className="text-xl font-medium">{ind.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {showFinancialCard && results.financials && (
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
                        <td className="px-2 py-1 whitespace-nowrap text-sm text-right text-darkgray">
                          {v.value.toFixed(2)} {v.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showPricesCard && (
            <div className="card">
              <h4 className="text-md font-medium mb-2">Price Changes</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={priceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="price" fill="#f97316" name="Price" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {showProductionCard && (
            <div className="card">
              <h4 className="text-md font-medium mb-2">Production Changes</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="production" fill="#10b981" name="Production" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;