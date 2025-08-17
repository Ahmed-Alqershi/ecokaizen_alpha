import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { createProject, listProjects, deleteProject, updateProjectStatus } from '../utils/api';
import { Project } from '../utils/types';
import TemplateDropdown from '../components/TemplateDropdown';
import {
  FolderOpenIcon,
  ArchiveBoxArrowDownIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const ProjectsPage = () => {
  const { username } = useContext(AuthContext);
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [nameError, setNameError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'name'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'open' | 'archived'>('open');

  const templates = [
    {
      id: 'A',
      name: 'Standard m×n×1 Template',
      description:
        'A simplified CGE model template that supports m sectors, n household groups, two production factors (Labor and Capital), and no government or external sector.'
    },
    {
      id: 'B',
      name: 'Extended Economy Template',
      description:
        'Includes government, trade flows, and additional production factors for richer policy simulations.'
    }
  ];

  const loadProjects = async () => {
    if (!username) return;
    const data = await listProjects(username);
    setProjects(data);
  };

  useEffect(() => {
    loadProjects();
  }, [username]);

  const handleSave = async () => {
    let valid = true;
    if (!newName.trim()) {
      setNameError('Project name is required');
      valid = false;
    }
    if (!newTemplate) {
      setTemplateError('Template is required');
      valid = false;
    }
    if (!valid) return;

    await createProject(
      username,
      newName.trim(),
      newDescription.trim(),
      newTemplate
    );
    setShowModal(false);
    setNewName('');
    setNewDescription('');
    setNewTemplate('');
    setNameError('');
    setTemplateError('');
    loadProjects();
  };

  const formatDate = (str: string) => {
    const d = new Date(str);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${day}/${month}/${year} • ${time}`;
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
            <button
              className="p-1 text-sm"
              onClick={toggleSortOrder}
              aria-label="Toggle sort order"
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </button>
            <label className="text-sm">Sort by:</label>
            <select
              className="input text-sm w-40 px-2 py-1"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="updated_at">Updated</option>
              <option value="created_at">Created</option>
              <option value="name">Name</option>
            </select>
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
                className="card p-4 border border-midgray shadow-sm flex flex-col"
              >
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-baseline">
                      <h2 className="text-lg font-semibold">{p.name}</h2>
                      <span
                        className={`ml-2 inline-flex items-center text-white text-xs px-2 py-0.5 rounded ${
                          p.status === 'archived' ? 'bg-red-800' : 'bg-green-800'
                        }`}
                      >
                        {p.status === 'archived' ? 'Archived' : 'Active'}
                      </span>
                    </div>
                    <p className="text-sm">
                      <span className="font-bold">Description:</span> {p.description || ''}
                    </p>
                    <p className="text-sm">
                      <span className="font-bold">Template:</span> {
                        templates.find((t) => t.id === p.template)?.name || p.template
                      }
                    </p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <button
                      className="p-1 hover:opacity-80"
                      onClick={() => handleOpen(p.id)}
                      title="Open Project"
                      aria-label="Open project"
                    >
                      <FolderOpenIcon className="w-5 h-5 text-[#2F3A4A]" />
                    </button>
                    {p.status === 'archived' ? (
                      <button
                        className="p-1 hover:opacity-80"
                        onClick={() => handleRestore(p.id)}
                        title="Restore to Active"
                        aria-label="Restore project"
                      >
                        <ArrowPathIcon className="w-5 h-5 text-[#2F3A4A]" />
                      </button>
                    ) : (
                      <button
                        className="p-1 hover:opacity-80"
                        onClick={() => handleArchive(p.id)}
                        title="Archive Project"
                        aria-label="Archive project"
                      >
                        <ArchiveBoxArrowDownIcon className="w-5 h-5 text-[#2F3A4A]" />
                      </button>
                    )}
                    <button
                      className="p-1 hover:opacity-80"
                      onClick={() => handleDelete(p.id)}
                      title="Delete Project"
                      aria-label="Delete project"
                    >
                      <TrashIcon className="w-5 h-5 text-[#2F3A4A]" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 text-xs text-darkgray/70">
                  <p>
                    <span className="font-bold">Created on:</span> {formatDate(p.created_at)}{' '}
                    <span className="mx-2">—</span>
                    <span className="font-bold">Updated on:</span> {formatDate(p.updated_at)}
                  </p>
                </div>
              </div>
            ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-6">New Project</h2>
            <div className="space-y-6">
              <div>
                <label className="block mb-1 text-sm font-semibold">Project Name</label>
                <input
                  type="text"
                  className={`input w-full ${nameError ? 'border-danger focus:ring-danger' : ''}`}
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (nameError) setNameError('');
                  }}
                />
                {nameError && (
                  <p className="mt-1 text-xs text-danger">{nameError}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Description (optional)</label>
                <textarea
                  className="input w-full"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Template</label>
                <TemplateDropdown
                  templates={templates}
                  value={newTemplate}
                  onChange={(val) => {
                    setNewTemplate(val);
                    if (templateError) setTemplateError('');
                  }}
                  error={!!templateError}
                />
                {templateError && (
                  <p className="mt-1 text-xs text-danger">{templateError}</p>
                )}
              </div>
              <div className="pt-2 flex space-x-2">
                <button
                  className="btn bg-midgray text-darkgray hover:bg-midgray/80"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn bg-[#2F3A4A] hover:bg-[#3b4759] text-white"
                  onClick={handleSave}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
