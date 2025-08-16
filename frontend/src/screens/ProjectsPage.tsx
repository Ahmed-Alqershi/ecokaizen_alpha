import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { createProject, listProjects } from '../utils/api';
import { Project } from '../utils/types';

const ProjectsPage = () => {
  const { username } = useContext(AuthContext);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'name'>('updated_at');

  const loadProjects = async () => {
    if (!username) return;
    const data = await listProjects(username);
    setProjects(data);
  };

  useEffect(() => {
    loadProjects();
  }, [username]);

  const handleSave = async () => {
    if (!newName.trim()) return;
    await createProject(username, newName.trim());
    setShowModal(false);
    setNewName('');
    loadProjects();
  };

  const formatDate = (str: string) => {
    const d = new Date(str);
    const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    const year = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date} • ${year} - ${time}`;
    };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
  });

  return (
    <div className="max-w-4xl mx-auto my-12 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          New Project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="flex justify-end mb-4">
          <label className="mr-2 text-sm">Sort by:</label>
          <select
            className="input w-40"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="updated_at">Updated</option>
            <option value="created_at">Created</option>
            <option value="name">Name</option>
          </select>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center text-darkgray/70 mt-20">
          <p>You don't have any projects yet. Click 'New Project' to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedProjects.map((p) => (
            <div key={p.id} className="card p-4 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">{p.name}</h2>
                <p className="text-sm text-darkgray/70">Created on {formatDate(p.created_at)}</p>
                <p className="text-sm text-darkgray/70">Updated on {formatDate(p.updated_at)}</p>
              </div>
              <button className="btn btn-secondary">Open</button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">New Project</h2>
            <label className="block mb-2 text-sm font-medium">Project Name</label>
            <input
              type="text"
              className="input w-full mb-4"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
