import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const HomePage = () => {
  const { username } = useContext(AuthContext);
  const features = [
    {
      icon: '📊',
      title: 'Drag & Drop SAM Editor',
      description: 'Upload or edit your Social Accounting Matrix with our intuitive interface.'
    },
    {
      icon: '📑',
      title: 'Ready-to-use Templates',
      description: 'Start with pre-configured models for different economic contexts.'
    },
    {
      icon: '🔬',
      title: 'Policy Scenario Simulations',
      description: 'Compare baseline and alternative policy scenarios side by side.'
    },
    {
      icon: '📈',
      title: 'Excel + Chart Outputs',
      description: 'Visualize your model results through interactive charts and exportable data.'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="py-12 md:py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-darkgray mb-4">
          Build and Analyze CGE Models Without Writing Code
        </h1>
        <p className="text-xl md:text-2xl text-darkgray/70 max-w-3xl mx-auto mb-8">
          Empower decision-making with economic simulations. No math required.
        </p>
        <Link
          to={username ? '/model-builder' : '/signup'}
          className="btn btn-gradient-outline text-lg py-3 px-8"
        >
          {username ? 'Build Your Model' : 'Get Started'}
        </Link>
      </div>

      {/* Feature Highlights */}
      <div className="py-12">
        <h2 className="text-2xl font-bold text-center mb-12">Platform Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="feature-card flex flex-col items-center text-center">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-darkgray/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* About Section */}
      <div className="py-12 bg-neutral rounded-xl p-8 my-8">
        <h2 className="text-2xl font-bold mb-6">About CGE Models</h2>
        <div className="text-darkgray/80 space-y-4">
          <p>
            Computable General Equilibrium (CGE) models are powerful tools for understanding how 
            economic policies affect different sectors, households, and markets.
          </p>
          <p>
            Our platform makes CGE modeling accessible to policy analysts, researchers, and
            students without requiring deep mathematical expertise or programming skills.
          </p>
          <p>
            Perfect for policy evaluation, trade analysis, tax reform assessment, and educational
            purposes, our tool bridges the gap between complex economic theory and practical applications.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;