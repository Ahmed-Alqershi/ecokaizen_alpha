import React from 'react';

interface HouseholdData {
  'Benchmark'?: number;
  'After Shock'?: number;
  'Change (%)'?: number;
}

interface HouseholdAnalyticsProps {
  householdData: {
    Income?: Record<string, HouseholdData>;
    'Labor Supply'?: Record<string, HouseholdData>;
  };
  comparisonMode?: boolean;
  scenario1?: {
    name: string;
    professional_reports?: {
      sector_household?: {
        Income?: Record<string, HouseholdData>;
        'Labor Supply'?: Record<string, HouseholdData>;
      };
    };
  };
}

const HouseholdAnalyticsMatrix: React.FC<HouseholdAnalyticsProps> = ({
  householdData,
  comparisonMode,
  scenario1
}) => {
  const incomeData = householdData?.Income || {};
  const laborSupplyData = householdData?.['Labor Supply'] || {};
  
  // Get all households from both categories
  const householdsSet: Record<string, boolean> = {};
  Object.keys(incomeData).forEach((h) => (householdsSet[h] = true));
  Object.keys(laborSupplyData).forEach((h) => (householdsSet[h] = true));
  const households = Object.keys(householdsSet);
  
  const categories = ['Income', 'Labor Supply'];
  
  const calculatePercentage = (bench: number | undefined, after: number | undefined, changePercent: number | undefined): number => {
    if (typeof changePercent === 'number' && !isNaN(changePercent)) return changePercent * 100;
    if (typeof bench === 'number' && typeof after === 'number' && bench !== 0) return ((after - bench) / bench) * 100;
    return 0;
  };

  const renderCard = (category: string, household: string) => {
    const categoryData = category === 'Income' ? incomeData : laborSupplyData;
    const cell = categoryData?.[household] || {};
    const bench = cell['Benchmark'];
    const after = cell['After Shock'];
    const pct = calculatePercentage(bench, after, cell['Change (%)']);
    
    const scenarioCell = comparisonMode && scenario1?.professional_reports?.sector_household?.[category]?.[household];
    const scenarioAfter = typeof scenarioCell?.['After Shock'] === 'number' ? scenarioCell['After Shock'] : null;
    
    return (
      <div key={`${category}-${household}`} className="group m-1 relative">
        {/* Gradient glow */}
        <div className={`absolute -inset-0.5 rounded-xl opacity-20 group-hover:opacity-40 transition-all duration-300 ${
          pct >= 0 
            ? 'bg-gradient-to-r from-emerald-400 to-teal-500' 
            : 'bg-gradient-to-r from-red-400 to-pink-500'
        }`}></div>
        
        {/* Main card */}
        <div className="relative bg-white/90 backdrop-blur-sm border border-white/50 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
          {/* Header with direction indicator */}
          <div className="flex items-center justify-end mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs ${
              pct >= 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-red-400 to-red-500'
            }`}>
              {pct >= 0 ? '↗' : '↘'}
            </div>
          </div>
          
          {/* Main value */}
          <div className="mb-2">
            <div className="text-lg font-bold text-gray-800">
              {typeof after === 'number' ? after.toFixed(4) : 'N/A'}
            </div>
          </div>
          
          {/* Change badge */}
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold mb-2 ${
            pct >= 0 
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
          </div>
          
          {/* Benchmark */}
          <div className="text-[10px] text-gray-500 mb-1">
            Base: {typeof bench === 'number' ? bench.toFixed(4) : 'N/A'}
          </div>
          
          {/* Scenario comparison */}
          {scenarioAfter !== null && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="text-[10px] text-blue-600 font-medium mb-1">
                📊 {scenario1?.name}: {scenarioAfter.toFixed(4)}
              </div>
              {(() => {
                const scenarioPct = calculatePercentage(bench, scenarioAfter, scenarioCell?.['Change (%)']);
                return (
                  <div className={`text-[10px] font-medium ${
                    scenarioPct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Scenario impact: {scenarioPct >= 0 ? '+' : ''}{scenarioPct.toFixed(2)}%
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Percentage change indicator */}
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-1">
              <div 
                className={`h-1 rounded-full transition-all duration-1000 ${
                  pct >= 0 
                    ? 'bg-gradient-to-r from-emerald-400 to-green-500' 
                    : 'bg-gradient-to-r from-red-400 to-red-500'
                }`}
                style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const header = (
    <div className="grid sticky top-0 z-10 bg-gradient-to-r from-emerald-50 to-teal-50 backdrop-blur-sm rounded-t-xl border-b border-emerald-200" style={{ gridTemplateColumns: `200px repeat(${households.length}, minmax(160px, 1fr))` }}>
      <div className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase tracking-widest">Category / Household</div>
      {households.map((h, idx) => (
        <div key={h} className="px-2 py-3 text-xs uppercase tracking-widest text-emerald-600 font-bold text-center">
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${
            idx % 2 === 0 ? 'from-emerald-100 to-teal-100' : 'from-teal-100 to-emerald-100'
          } border border-emerald-200`}>
            <span>🏠</span>
            {h}
          </div>
        </div>
      ))}
    </div>
  );
  
  const rows = categories.map((category, categoryIdx) => (
    <div key={category} className="grid items-stretch hover:bg-emerald-50/30 transition-colors duration-200" style={{ gridTemplateColumns: `200px repeat(${households.length}, minmax(160px, 1fr))` }}>
      <div className="pr-3 py-4 flex items-center">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-200 rounded-xl">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
            {categoryIdx + 1}
          </div>
          <span className="text-sm font-bold text-emerald-700">{category}</span>
        </div>
      </div>
      {households.map((household) => renderCard(category, household))}
    </div>
  ));
  
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-teal-200 to-cyan-200 rounded-2xl opacity-20"></div>
      <div className="relative bg-white/60 backdrop-blur-sm border border-white/40 rounded-2xl shadow-2xl overflow-hidden">
        {header}
        <div className="divide-y divide-emerald-100">
          {rows}
        </div>
      </div>
    </div>
  );
};

export default HouseholdAnalyticsMatrix;
