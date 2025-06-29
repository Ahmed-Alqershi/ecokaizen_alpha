import React, { useState } from 'react';

const SandboxPage: React.FC = () => {
  const [tariff, setTariff] = useState(0);
  const [output, setOutput] = useState(100);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setTariff(value);
    // Very basic effect: output decreases as tariff increases
    setOutput(100 - value);
  };

  return (
    <div className="container">
      <h2>Sample Sandbox</h2>
      <p>
        Adjust the tariff shock and see how the model reacts.{' '}
        <span className="tooltip" title="A Social Accounting Matrix shows economic flows between sectors.">
          What is a SAM?
        </span>
      </p>
      <label>
        Tariff Shock (%): {tariff}
        <input type="range" min="0" max="100" value={tariff} onChange={handleChange} />
      </label>
      <div className="sandbox">
        <p>Output level: {output}</p>
      </div>
      <button onClick={() => alert('Issue reported')}>Report issue</button>
    </div>
  );
};

export default SandboxPage;
