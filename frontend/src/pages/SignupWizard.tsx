import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = ['Your Name', 'Organization', 'Primary Use Case'];

const SignupWizard: React.FC = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [useCase, setUseCase] = useState('policy analysis');
  const navigate = useNavigate();

  const progress = ((step + 1) / steps.length) * 100;

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      alert(`Name: ${name}\nOrg: ${organization}\nUse Case: ${useCase}`);
      navigate('/');
    }
  };

  const skip = () => navigate('/');

  return (
    <div className="container wizard">
      <h2>Sign Up</h2>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
      {step === 0 && (
        <div>
          <label>
            Name:
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
      )}
      {step === 1 && (
        <div>
          <label>
            Organization:
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </label>
        </div>
      )}
      {step === 2 && (
        <div>
          <label>
            Primary Use Case:
            <select value={useCase} onChange={(e) => setUseCase(e.target.value)}>
              <option value="policy analysis">Policy Analysis</option>
              <option value="academic research">Academic Research</option>
              <option value="private sector">Private Sector</option>
            </select>
          </label>
        </div>
      )}
      <div className="wizard-nav">
        <button onClick={next}>{step === steps.length - 1 ? 'Finish' : 'Next'}</button>
        <button onClick={skip}>Skip for now</button>
      </div>
    </div>
  );
};

export default SignupWizard;
