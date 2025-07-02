import React from 'react';

const BlogPage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      <section className="space-y-4 animate-fadeInUp">
        <h1 className="text-3xl font-bold">Computable General Equilibrium</h1>
        <p className="text-darkgray/80">
          Computable General Equilibrium (CGE) models are powerful tools used to capture the complex interactions
          within an economy. They consider how households, firms and governments respond to policy changes
          and external shocks, providing valuable insights for decision makers.
        </p>
      </section>
      <section className="space-y-4 animate-fadeInUp bg-neutral rounded-lg p-6 shadow">
        <h2 className="text-2xl font-bold">Why CGE Models?</h2>
        <p>
          CGE models ensure that supply equals demand across all markets while accounting for behavioral responses.
          They are frequently used for trade policy analysis, tax reform evaluation and forecasting economic growth.
        </p>
      </section>
      <section className="space-y-4 animate-fadeInUp">
        <h2 className="text-2xl font-bold">Applications</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Assessing the impact of new tax policies on households and firms.</li>
          <li>Evaluating trade agreements and tariffs.</li>
          <li>Analyzing environmental regulations and climate policies.</li>
        </ul>
      </section>
    </div>
  );
};

export default BlogPage;
