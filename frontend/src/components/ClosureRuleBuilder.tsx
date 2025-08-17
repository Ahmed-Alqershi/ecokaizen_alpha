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
          className="border p-1"
        >
          <option value="">Select variable</option>
          <option value="XS">XS (supply)</option>
          <option value="P">P (price)</option>
          <option value="W">W (wage)</option>
          <option value="LS">LS (labor supply)</option>
        </select>
        <select
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          className="border p-1 flex-1"
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
          className="btn btn-primary"
        >
          Add
        </button>
      </div>
      <ul className="mt-2">
        {rules.map((r, i) => (
          <li key={i} className="flex justify-between items-center border-b py-1">
            <span>
              Fix {r.variable}[{r.indices[0] || 'all'}] = benchmark
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-red-500"
            >
              ✖
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClosureRuleBuilder;
