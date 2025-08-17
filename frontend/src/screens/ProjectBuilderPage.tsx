import { useParams } from 'react-router-dom';

const ProjectBuilderPage = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="max-w-4xl mx-auto my-12 p-4" data-project-id={projectId}>
      <div className="bg-[#2F3A4A] text-white rounded-lg p-8 text-center shadow-lg">
        <h1 className="text-3xl font-bold mb-4">Welcome to your Model Builder!</h1>
        <p className="mb-6">
          Let's help you set up and run your CGE model step-by-step.
        </p>
        <button className="btn bg-white text-[#2F3A4A] hover:bg-white/90">
          Start Building
        </button>
      </div>
    </div>
  );
};

export default ProjectBuilderPage;

