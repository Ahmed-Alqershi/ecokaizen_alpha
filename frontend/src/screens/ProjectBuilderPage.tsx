import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import FileUploader from '../components/FileUploader';
import { SAM } from '../utils/types';

const ProjectBuilderPage = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [industries, setIndustries] = useState(2);
  const [consumers, setConsumers] = useState(1);
  const [goodsNames, setGoodsNames] = useState<string[]>(['IND1', 'IND2']);
  const [consumerNames, setConsumerNames] = useState<string[]>(['HH1']);
  const [goodsPrices, setGoodsPrices] = useState<number[]>([1, 1]);
  const [wageRate, setWageRate] = useState(1);
  const factorNames = ['LAB', 'CAP'];
  const [useSamNames, setUseSamNames] = useState(true);
  const [sam, setSam] = useState<SAM | null>(null);
  const [samError, setSamError] = useState('');
  const [goodsError, setGoodsError] = useState('');
  const [consumerError, setConsumerError] = useState('');

  const adjustLength = (arr: string[], len: number, prefix: string) => {
    const copy = [...arr];
    if (copy.length < len) {
      for (let i = copy.length; i < len; i++) copy.push(`${prefix}${i + 1}`);
    } else if (copy.length > len) {
      copy.length = len;
    }
    return copy;
  };

  useEffect(() => {
    setGoodsNames((prev) => adjustLength(prev, industries, 'IND'));
  }, [industries]);

  useEffect(() => {
    setConsumerNames((prev) => adjustLength(prev, consumers, 'HH'));
  }, [consumers]);

  useEffect(() => {
    if (!sam) return;
    const expected = industries + factorNames.length + consumers;
    if (
      sam.data.length !== expected ||
      sam.data.some((row) => row.length !== expected)
    ) {
      setSamError(
        `SAM dimensions (${sam.data.length}x${sam.data.length}) do not match m=${industries} and n=${consumers}.`
      );
    } else {
      setSamError('');
    }
  }, [sam, industries, consumers]);

  const handleGoodsInput = (value: string) => {
    const names = value.split(',').map((n) => n.trim()).filter(Boolean);
    setGoodsNames(adjustLength(names, industries, 'IND'));
    setGoodsError(
      names.length === industries ? '' : `Enter ${industries} names`
    );
  };

  const handleConsumersInput = (value: string) => {
    const names = value.split(',').map((n) => n.trim()).filter(Boolean);
    setConsumerNames(adjustLength(names, consumers, 'HH'));
    setConsumerError(
      names.length === consumers ? '' : `Enter ${consumers} names`
    );
  };

  const adjustPriceLength = (arr: number[], len: number) => {
    const copy = [...arr];
    if (copy.length < len) {
      for (let i = copy.length; i < len; i++) copy.push(1);
    } else if (copy.length > len) {
      copy.length = len;
    }
    return copy;
  };

  useEffect(() => {
    setGoodsPrices((prev) => adjustPriceLength(prev, industries));
  }, [industries]);

  return (
    <div
      className="max-w-2xl mx-auto my-12 p-4 space-y-8"
      data-project-id={projectId}
    >
      <div className="bg-[#2F3A4A] text-white rounded-lg p-6 text-center shadow-lg">
        <h1 className="text-2xl font-bold mb-2">
          Welcome to your Model Builder!
        </h1>
        <p>
          Let's help you set up and run your CGE model step-by-step.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-[#2F3A4A] mb-4">
          1. SAM Setup
        </h2>
        <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
          <div>
            <label className="block mb-2 font-medium">Upload SAM</label>
            <FileUploader
              onSamLoaded={setSam}
              goods={goodsNames}
              factors={factorNames}
              households={consumerNames}
              autoPopulateNames={useSamNames}
              onNamesLoaded={(g, _f, h) => {
                setGoodsNames(g);
                setConsumerNames(h);
              }}
            />
            {samError && (
              <p className="mt-2 text-sm text-danger">{samError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">
                Number of industries (m)
              </label>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={industries}
                onChange={(e) => setIndustries(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">
                Number of consumers (n)
              </label>
              <input
                type="number"
                min={1}
                className="input w-full"
                value={consumers}
                onChange={(e) => setConsumers(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                className="mr-2"
                checked={useSamNames}
                onChange={(e) => setUseSamNames(e.target.checked)}
              />
              <span className="text-sm">Load names from uploaded SAM</span>
            </label>
          </div>

      {!useSamNames && (
        <div className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">
              Industry Names (comma separated)
                </label>
                <input
                  type="text"
                  className={`input w-full ${
                    goodsError ? 'border-danger focus:ring-danger' : ''
                  }`}
                  value={goodsNames.join(', ')}
                  onChange={(e) => handleGoodsInput(e.target.value)}
                />
                {goodsError && (
                  <p className="mt-1 text-xs text-danger">{goodsError}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 font-medium">
                  Consumer Names (comma separated)
                </label>
                <input
                  type="text"
                  className={`input w-full ${
                    consumerError ? 'border-danger focus:ring-danger' : ''
                  }`}
                  value={consumerNames.join(', ')}
                  onChange={(e) => handleConsumersInput(e.target.value)}
                />
                {consumerError && (
                  <p className="mt-1 text-xs text-danger">{consumerError}</p>
                )}
          </div>
        </div>
      )}
    </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-[#2F3A4A] mb-4">
          2. Benchmark Prices
        </h2>
        <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
          <div>
            <label className="block mb-2 font-medium">Price of goods (PO)</label>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="pb-2">Industry</th>
                  <th className="pb-2">Benchmark Price (PO)</th>
                </tr>
              </thead>
              <tbody>
                {goodsNames.map((name, idx) => (
                  <tr key={name} className="align-top">
                    <td className="py-2 pr-4">{name}</td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="any"
                        className={`input w-full ${
                          goodsPrices[idx] > 0
                            ? ''
                            : 'border-danger focus:ring-danger'
                        }`}
                        value={goodsPrices[idx]}
                        placeholder="Enter price (PO)"
                        onChange={(e) => {
                          const arr = [...goodsPrices];
                          arr[idx] = parseFloat(e.target.value);
                          setGoodsPrices(arr);
                        }}
                      />
                      {goodsPrices[idx] > 0 ? null : (
                        <p className="mt-1 text-xs text-danger">
                          Enter a positive number
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <label className="block mb-2 font-medium">Wage rate (WO)</label>
            <input
              type="number"
              step="any"
              className={`input w-full ${
                wageRate > 0 ? '' : 'border-danger focus:ring-danger'
              }`}
              value={wageRate}
              placeholder="Enter wage rate (WO)"
              onChange={(e) => setWageRate(parseFloat(e.target.value))}
            />
            {wageRate > 0 ? null : (
              <p className="mt-1 text-xs text-danger">Enter a positive number</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              The wage rate represents the price of labor. Default = 1.0
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProjectBuilderPage;

