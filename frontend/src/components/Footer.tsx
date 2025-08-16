import logo from '../../static/logo.png';

const Footer = () => {
  return (
    <footer className="bg-white py-6 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-t border-midgray/30 pt-6">
          <div className="flex flex-col md:flex-row md:justify-between items-center">
            <p className="text-sm text-darkgray/70 flex items-center space-x-2">
              <img src={logo} alt="Kaizen logo" className="w-6 h-6" />
              <span>&copy; {new Date().getFullYear()} CGE Model Builder Platform</span>
            </p>
            <div className="mt-4 md:mt-0">
              <ul className="flex space-x-6">
                <li>
                  <a href="/about" className="text-sm text-darkgray/70 hover:text-primary">
                    About
                  </a>
                </li>
                <li>
                  <a href="/blog" className="text-sm text-darkgray/70 hover:text-primary">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="/contact-us" className="text-sm text-darkgray/70 hover:text-primary">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;