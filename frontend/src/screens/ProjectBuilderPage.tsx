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

  return (
    <div
      className="max-w-4xl mx-auto my-12 p-4 space-y-8"
      data-project-id={projectId}
    >
      <div className="bg-[#2F3A4A] text-white rounded-lg p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold mb-4">
          Welcome to your Model Builder!
        </h1>
        <p className="mb-6">
          Let's help you set up and run your CGE model step-by-step.
        </p>
        <button className="btn btn-primary">Start Building</button>
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
    </div>
  );
};

export default ProjectBuilderPage;

