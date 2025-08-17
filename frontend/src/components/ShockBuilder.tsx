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
      case 'D':
      case 'XS':
        return ['all', ...goods];
      case 'LS':
        return ['all', ...consumers];
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
          className="border p-1"
        >
          <option value="">Select target</option>
          <option value="P">P (price)</option>
          <option value="D">D (demand)</option>
          <option value="XS">XS (supply)</option>
          <option value="LS">LS (labor supply)</option>
        </select>
        <select
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          className="border p-1"
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
          className="border p-1 w-24"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="btn btn-primary"
        >
          Add
        </button>
      </div>
      <ul className="mt-2">
        {shocks.map((s, i) => {
          const percent = ((s.multiplier - 1) * 100).toFixed(0);
          return (
            <li key={i} className="flex justify-between items-center border-b py-1">
              <span>
                Apply {percent}% change to {s.target}[{s.indices[0] || 'all'}]
              </span>
              <button
                onClick={() => onRemove(i)}
                className="text-red-500"
              >
                ✖
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ShockBuilder;

