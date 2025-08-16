import { useState } from 'react';
import { ClosureRule } from '../utils/types';

interface Props {
  rules: ClosureRule[];
  onAdd: (rule: ClosureRule) => void;
  onRemove: (index: number) => void;
}

const ClosureRuleBuilder = ({ rules, onAdd, onRemove }: Props) => {
  const [variable, setVariable] = useState('');
  const [indices, setIndices] = useState('');

  const handleAdd = () => {
    if (!variable) return;
    const idx = indices
      ? indices.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    onAdd({ variable, indices: idx });
    setVariable('');
    setIndices('');
  };

  return (
    <div>
      <div className="flex gap-2 items-center">
        <select
          value={variable}
          onChange={(e) => setVariable(e.target.value)}
          className="border p-1"
        >
          <option value="">Select variable</option>
          <option value="P">P (price)</option>
          <option value="W">W (wage)</option>
          <option value="LS">LS (labor supply)</option>
        </select>
        <input
          type="text"
          value={indices}
          onChange={(e) => setIndices(e.target.value)}
          placeholder="Indices (comma separated)"
          className="border p-1 flex-1"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-blue-500 text-white px-2 py-1"
        >
          Add
        </button>
      </div>
      <ul className="mt-2">
        {rules.map((r, i) => (
          <li key={i} className="flex justify-between items-center border-b py-1">
            <span>
              {r.variable}[{r.indices.join(',') || 'all'}]
            </span>
            <button
              onClick={() => onRemove(i)}
              className="text-red-500"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClosureRuleBuilder;
