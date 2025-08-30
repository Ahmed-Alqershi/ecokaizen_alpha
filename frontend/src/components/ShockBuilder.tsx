import { useState } from 'react';
import { Shock } from '../utils/types';

interface Props {
  shocks: Shock[];
  goods: string[];
  consumers: string[];
  onAdd: (shock: Shock) => void;
  onRemove: (index: number) => void;
}

const ShockBuilder = ({ shocks, goods, consumers, onAdd, onRemove }: Props) => {
  const [target, setTarget] = useState('');
  const [index, setIndex] = useState('all');
  const [multiplier, setMultiplier] = useState(1);

  const indexOptions = () => {
    switch (target) {
      case 'P':
      case 'XS':
        return ['all', ...goods];
      case 'D':
        return ['all', ...consumers.flatMap(c => goods.map(g => `${c}_${g}`))];
      case 'LS':
        return ['all', ...consumers];
      case 'W':
        return ['all'];
      case 'A':
      case 'ALPHA':
        return ['all', ...goods];
      case 'BETA':
        return ['all', ...consumers.flatMap(c => goods.map(g => `${c}_${g}`))];
      default:
        return ['all'];
    }
  };

  const handleAdd = () => {
    if (!target) return;
    const idx = index === 'all' ? [] : [index];
    onAdd({ target, indices: idx, multiplier: Number(multiplier) });
    setTarget('');
    setIndex('all');
    setMultiplier(1);
  };

  return (
    <div>
      <div className="flex gap-2 items-center">
        <select
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setIndex('all');
          }}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select target</option>
          <option value="P">Commodity Price</option>
          <option value="XS">Commodity Supply</option>
          <option value="D">Commodity Demand</option>
          <option value="W">Wage Rate</option>
          <option value="LS">Labor Supply</option>
          <option value="A">Productivity Parameter (affects output efficiency)</option>
          <option value="ALPHA">Share Parameter (controls factor shares in production)</option>
          <option value="BETA">Substitution Parameter (controls substitution elasticity)</option>
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
        <input
          type="number"
          step="0.01"
          value={multiplier}
          onChange={(e) => setMultiplier(Number(e.target.value))}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-24"
          placeholder="1.0"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!target}
          className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add Shock
        </button>
      </div>
      {shocks.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Applied Economic Shocks</h4>
          <div className="space-y-2">
            {shocks.map((s, i) => {
              const percent = ((s.multiplier - 1) * 100).toFixed(1);
              const isParameter = ['A', 'ALPHA', 'BETA'].includes(s.target);
              const targetNames = {
                'P': 'Commodity Price',
                'XS': 'Commodity Supply',
                'D': 'Commodity Demand',
                'W': 'Wage Rate',
                'LS': 'Labor Supply',
                'A': 'Productivity Parameter',
                'ALPHA': 'Share Parameter',
                'BETA': 'Substitution Parameter'
              };
              const targetName = targetNames[s.target as keyof typeof targetNames] || s.target;
              const indexDisplay = s.indices[0] || 'all';
              const sign = s.multiplier >= 1 ? '+' : '';
              
              return (
                <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                  isParameter 
                    ? 'bg-purple-50 border-purple-200' 
                    : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      isParameter ? 'bg-purple-500' : 'bg-orange-500'
                    }`}></div>
                    <span className="text-sm text-slate-700">
                      <span className="font-medium">{sign}{percent}%</span>
                      <span className="text-slate-500"> change to </span>
                      <span className="font-medium">{targetName}</span>
                      {indexDisplay !== 'all' && (
                        <span className="text-slate-500"> for {indexDisplay}</span>
                      )}
                      {isParameter && (
                        <span className="text-purple-600 text-xs ml-1 font-medium">(parameter)</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemove(i)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors"
                    title="Remove economic shock"
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

export default ShockBuilder;

