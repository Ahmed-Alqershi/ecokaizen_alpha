import { useState } from 'react';
import { Shock } from '../utils/types';

interface Props {
  shocks: Shock[];
  onAdd: (shock: Shock) => void;
  onRemove: (index: number) => void;
}

const ShockBuilder = ({ shocks, onAdd, onRemove }: Props) => {
  const [target, setTarget] = useState('');
  const [indices, setIndices] = useState('');
  const [multiplier, setMultiplier] = useState(1);

  const handleAdd = () => {
    if (!target) return;
    const idx = indices
      ? indices.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    onAdd({ target, indices: idx, multiplier: Number(multiplier) });
    setTarget('');
    setIndices('');
    setMultiplier(1);
  };

  return (
    <div>
      <div className="flex gap-2 items-center">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="border p-1"
        >
          <option value="">Select target</option>
          <option value="A">A (productivity)</option>
          <option value="BETA">BETA (consumption)</option>
          <option value="LS">LS (labor supply)</option>
        </select>
        <input
          type="text"
          value={indices}
          onChange={(e) => setIndices(e.target.value)}
          placeholder="Indices (comma separated)"
          className="border p-1 flex-1"
        />
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
          className="bg-blue-500 text-white px-2 py-1"
        >
          Add
        </button>
      </div>
      <ul className="mt-2">
        {shocks.map((s, i) => (
          <li key={i} className="flex justify-between items-center border-b py-1">
            <span>
              {s.target}[{s.indices.join(',') || 'all'}] × {s.multiplier}
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

export default ShockBuilder;
