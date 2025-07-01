import React from 'react';

const AboutPage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      <div className="space-y-4 animate-fadeInUp">
        <h1 className="text-3xl font-bold">About Us</h1>
        <p className="text-darkgray/80">
          Kaizen is a pioneering platform dedicated to making complex economic modeling accessible
          through intuitive interfaces and powerful visualizations. We believe that economic insights
          should be available to everyone, not just technical specialists.
        </p>
      </div>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Our Mission</h2>
        <p>
          Our mission is to democratize access to economic modeling tools by creating
          user-friendly interfaces for Computable General Equilibrium (CGE) models that
          provide valuable insights for policymakers, researchers, and educational institutions.
        </p>
      </section>
      <section className="space-y-6 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Our Team</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="card text-center space-y-2">
            <img src="https://via.placeholder.com/150" alt="Dr. Ibrahim Aljarrah" className="w-full" />
            <h3>Dr. Ibrahim Aljarrah</h3>
            <p className="text-sm">Founder &amp; Lead Economist</p>
            <p className="text-sm">PhD in Economic Modeling with 15+ years of experience in CGE model development.</p>
          </div>
          <div className="card text-center space-y-2">
            <img src="https://via.placeholder.com/150" alt="Almaen Salah" className="w-full" />
            <h3>Almaen Salah</h3>
            <p className="text-sm">Chief Technology Officer</p>
            <p className="text-sm">Expert in computational methods and visualization of economic data.</p>
          </div>
          <div className="card text-center space-y-2">
            <img src="https://via.placeholder.com/150" alt="Ahmed Alqershi" className="w-full" />
            <h3>Ahmed Alqershi</h3>
            <p className="text-sm">Lead Developer</p>
            <p className="text-sm">Specializes in creating interactive web applications for complex data.</p>
          </div>
        </div>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Our Partners</h2>
        <p>We collaborate with leading research institutions, universities, and government agencies.</p>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Contact Us</h2>
        <p>Email: <a className="text-primary" href="mailto:aalqershi@kaizen.sa">aalqershi@kaizen.sa</a></p>
        <p>Phone: +90 (553) 919 09 67</p>
        <p>Address: ...</p>
      </section>
    </div>
  );
};

export default AboutPage;
