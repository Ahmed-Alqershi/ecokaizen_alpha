import { useState } from 'react';
import { ClosureRule } from '../utils/types';

interface Props {
  rules: ClosureRule[];
  goods: string[];
  consumers: string[];
  onAdd: (rule: ClosureRule) => void;
  onRemove: (index: number) => void;
}

const ClosureRuleBuilder = ({ rules, goods, consumers, onAdd, onRemove }: Props) => {
  const [variable, setVariable] = useState('');
  const [index, setIndex] = useState('all');

  const indexOptions = () => {
    switch (variable) {
      case 'XS':
      case 'P':
        return ['all', ...goods];
      case 'D':
        return ['all', ...consumers.flatMap(c => goods.map(g => `${c}_${g}`))];
      case 'LS':
        return ['all', ...consumers];
      case 'W':
        return ['all'];
      default:
        return ['all'];
    }
  };

  const handleAdd = () => {
    if (!variable) return;
    const idx = index === 'all' ? [] : [index];
    onAdd({ variable, indices: idx });
    setVariable('');
    setIndex('all');
  };

  return (
    <div>
      <div className="flex gap-2 items-center">
        <select
          value={variable}
          onChange={(e) => {
            setVariable(e.target.value);
            setIndex('all');
          }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select variable</option>
          <option value="P">Commodity Price</option>
          <option value="XS">Commodity Supply</option>
          <option value="D">Commodity Demand</option>
          <option value="W">Wage Rate</option>
          <option value="LS">Labor Supply</option>
        </select>
        <select
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1"
        >
          {indexOptions().map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={!variable}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Rule
        </button>
      </div>
      {rules.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Applied Closure Rules</h4>
          <div className="space-y-2">
            {rules.map((r, i) => {
              const variableNames = {
                'P': 'Commodity Price',
                'XS': 'Commodity Supply',
                'D': 'Commodity Demand',
                'W': 'Wage Rate',
                'LS': 'Labor Supply'
              };
              const variableName = variableNames[r.variable as keyof typeof variableNames] || r.variable;
              const indexDisplay = r.indices[0] || 'all sectors';
              
              return (
                <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-slate-700">
                      <span className="font-medium">{variableName}</span>
                      {indexDisplay !== 'all sectors' && (
                        <span className="text-slate-500"> for {indexDisplay}</span>
                      )}
                      <span className="text-slate-500"> fixed at benchmark value</span>
                    </span>
                  </div>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
                    title="Remove closure rule"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClosureRuleBuilder;
