import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { createProject, listProjects, deleteProject, updateProjectStatus } from '../utils/api';
import { Project } from '../utils/types';

const ProjectsPage = () => {
  const { username } = useContext(AuthContext);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'name'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'open' | 'archived'>('open');

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
      return sortOrder === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    return sortOrder === 'asc'
      ? new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime()
      : new Date(b[sortBy]).getTime() - new Date(a[sortBy]).getTime();
  });

  const toggleSortOrder = () =>
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    await deleteProject(username, id);
    loadProjects();
  };

  const handleArchive = async (id: number) => {
    await updateProjectStatus(username, id, 'archived');
    loadProjects();
  };

  const handleRestore = async (id: number) => {
    await updateProjectStatus(username, id, 'open');
    loadProjects();
  };

  const handleOpen = (id: number) => {
    navigate(`/projects/${id}`);
  };

  return (
    <div className="max-w-4xl mx-auto my-12 p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          New Project
        </button>
      </div>

      {projects.length > 0 && (
        <>
          <div className="flex space-x-4 mb-4">
            {['all', 'open', 'archived'].map((t) => (
              <button
                key={t}
                className={`pb-1 text-sm border-b-2 ${
                  filter === t ? 'border-primary text-primary' : 'border-transparent text-darkgray/70'
                }`}
                onClick={() => setFilter(t as 'all' | 'open' | 'archived')}
              >
                {t === 'all' ? 'All' : t === 'open' ? 'Open' : 'Archived'}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end mb-4 space-x-2">
            <label className="text-sm">Sort by:</label>
            <div className="flex items-center">
              <select
                className="input text-sm w-40 px-2 py-1"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="updated_at">Updated</option>
                <option value="created_at">Created</option>
                <option value="name">Name</option>
              </select>
              <button
                className="ml-0 p-1 text-sm"
                onClick={toggleSortOrder}
                aria-label="Toggle sort order"
              >
                {sortOrder === 'asc' ? '▲' : '▼'}
              </button>
            </div>
          </div>
        </>
      )}

      {projects.length === 0 ? (
        <div className="text-center text-darkgray/70 mt-20">
          <p>You don't have any projects yet. Click 'New Project' to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedProjects
            .filter((p) =>
              filter === 'all'
                ? true
                : filter === 'open'
                ? p.status !== 'archived'
                : p.status === 'archived'
            )
            .map((p) => (
            <div
              key={p.id}
              className="card p-4 flex justify-between items-center border border-midgray shadow-sm"
            >
              <div>
                <div className="flex items-center">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  <span
                    className={`ml-2 text-white text-xs px-2 py-1 rounded ${
                      p.status === 'archived' ? 'bg-red-800' : 'bg-green-800'
                    }`}
                  >
                    {p.status === 'archived' ? 'Archived' : 'Active'}
                  </span>
                </div>
                <p className="text-sm text-darkgray/70">Created on {formatDate(p.created_at)}</p>
                <p className="text-sm text-darkgray/70">Updated on {formatDate(p.updated_at)}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  className="p-1 text-lg hover:opacity-80"
                  onClick={() => handleOpen(p.id)}
                  title="Open Project"
                  aria-label="Open project"
                >
                  📂
                </button>
                {p.status === 'archived' ? (
                  <button
                    className="p-1 text-lg hover:opacity-80"
                    onClick={() => handleRestore(p.id)}
                    title="Restore to Active"
                    aria-label="Restore project"
                  >
                    ♻️
                  </button>
                ) : (
                  <button
                    className="p-1 text-lg hover:opacity-80"
                    onClick={() => handleArchive(p.id)}
                    title="Archive Project"
                    aria-label="Archive project"
                  >
                    📥
                  </button>
                )}
                <button
                  className="p-1 text-lg text-danger hover:opacity-80"
                  onClick={() => handleDelete(p.id)}
                  title="Delete Project"
                  aria-label="Delete project"
                >
                  🗑️
                </button>
              </div>
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
