import React from 'react';
import logo from '../../static/logo.png';

const AboutPage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      <div className="space-y-4 animate-fadeInUp">
        <div className="flex items-center space-x-3">
          <img src={logo} alt="Kaizen logo" className="w-12 h-12" />
          <h1 className="text-3xl font-bold">About Kaizen</h1>
        </div>
        <p className="text-darkgray/80">
          Kaizen builds software that bridges the gap between advanced economic models and real-world decision
          making. Our platform delivers professional tools for constructing Computable General Equilibrium (CGE)
          models through an intuitive interface and interactive visualizations.
        </p>
      </div>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Our Mission</h2>
        <p>
          We democratize access to economic modeling tools by creating intuitive workflows for Computable General
          Equilibrium (CGE) models. Our solutions help policymakers and researchers gain actionable insights from
          complex data without steep technical barriers.
        </p>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">What We Offer</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Ready-to-use templates covering various economic structures</li>
          <li>Customizable SAM editors and parameter inputs</li>
          <li>Clear visualizations for scenario analysis</li>
          <li>Expert support and training services</li>
        </ul>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Our Partners</h2>
        <p>
          We collaborate with leading universities, research centers and government agencies around the world.
          Together we advance the practice of applied economic modeling.
        </p>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Get in Touch</h2>
        <p>
          Email: <a className="text-primary" href="mailto:contact@kaizen.sa">contact@kaizen.sa</a>
        </p>
        <p>Phone: +90 (553) 919 09 67</p>
        <p>Address: ...</p>
      </section>
    </div>
  );
};

export default AboutPage;
