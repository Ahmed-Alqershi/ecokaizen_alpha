import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();
  
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
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;