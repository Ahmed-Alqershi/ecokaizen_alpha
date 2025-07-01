import { Link, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const { username, logout } = useContext(AuthContext);
  
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
            {username && (
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
                  to="/model-builder"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/model-builder'
                      ? 'border-primary text-darkgray'
                      : 'border-transparent text-midgray hover:text-darkgray'
                  }`}
                >
                  Model Builder
                </Link>
                <Link
                  to="/table-test"
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    location.pathname === '/table-test'
                      ? 'border-primary text-darkgray'
                      : 'border-transparent text-midgray hover:text-darkgray'
                  }`}
                >
                  Table Test
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center">
            {username ? (
              <div className="relative group">
                <span className="font-bold cursor-pointer">{username}</span>
                <div className="absolute right-0 mt-2 w-24 bg-white border rounded shadow-lg hidden group-hover:block">
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  >
                    Log out
                  </button>
                </div>
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