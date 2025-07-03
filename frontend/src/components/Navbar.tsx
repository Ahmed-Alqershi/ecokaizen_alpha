import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, avatar, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };
  
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-primary">
                CGE Model Builder
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/'
                    ? 'border-primary text-darkgray'
                    : 'border-transparent text-midgray hover:text-darkgray'
                }`}
              >
                Home
              </Link>
              <Link
                to="/blog"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/blog'
                    ? 'border-primary text-darkgray'
                    : 'border-transparent text-midgray hover:text-darkgray'
                }`}
              >
                Blog
              </Link>
              <Link
                to="/about"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/about'
                    ? 'border-primary text-darkgray'
                    : 'border-transparent text-midgray hover:text-darkgray'
                }`}
              >
                About
              </Link>
              <Link
                to="/contact"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/contact'
                    ? 'border-primary text-darkgray'
                    : 'border-transparent text-midgray hover:text-darkgray'
                }`}
              >
                Contact
              </Link>
              {username && (
                <Link
                  to="/model-builder"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/model-builder'
                      ? 'border-primary text-darkgray'
                      : 'border-transparent text-midgray hover:text-darkgray'
                  }`}
                >
                  Model Builder
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center">
            {username ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="font-bold text-blue-800 flex items-center focus:outline-none"
                >
                  {avatar && (
                    <img
                      src={`/avatars/${avatar}`}
                      alt="avatar"
                      className="w-8 h-8 rounded-full mr-2"
                    />
                  )}
                  {username}
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform transform ${menuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-24 bg-white border rounded shadow-lg">
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link
                  to="/login"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/login'
                      ? 'border-primary text-darkgray'
                      : 'border-transparent text-midgray hover:text-darkgray'
                  }`}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/signup'
                      ? 'border-primary text-darkgray'
                      : 'border-transparent text-midgray hover:text-darkgray'
                  }`}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
