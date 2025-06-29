import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SandboxPage from './pages/SandboxPage';
import SignupWizard from './pages/SignupWizard';

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/sandbox" element={<SandboxPage />} />
      <Route path="/signup" element={<SignupWizard />} />
    </Routes>
  );
};

export default App;
