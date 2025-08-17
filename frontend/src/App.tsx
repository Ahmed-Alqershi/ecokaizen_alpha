import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './screens/HomePage';
import ModelBuilderPage from './screens/ModelBuilderPage';
import LoginPage from './screens/LoginPage';
import SignupPage from './screens/SignupPage';
import AboutPage from './screens/AboutPage';
import BlogPage from './screens/BlogPage';
import ContactUsPage from './screens/ContactUsPage';
import ProjectsPage from './screens/ProjectsPage';
import ProjectBuilderPage from './screens/ProjectBuilderPage';
import './styles/index.css';

const App = () => {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact-us" element={<ContactUsPage />} />
            <Route path="/model-builder" element={<ModelBuilderPage />} />
            <Route path="/projects/:projectId/builder" element={<ProjectBuilderPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;