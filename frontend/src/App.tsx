import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './screens/HomePage';
import ModelBuilderPage from './screens/ModelBuilderPage';
import LoginPage from './screens/LoginPage';
import SignupPage from './screens/SignupPage';
import AboutPage from './screens/AboutPage';
import BlogPage from './screens/BlogPage';
import ContactPage from './screens/ContactPage';
import RunHistoryPage from './screens/RunHistoryPage';
import ProjectWizardPage from './screens/ProjectWizardPage';
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
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/model-builder" element={<ModelBuilderPage />} />
            <Route path="/project-wizard" element={<ProjectWizardPage />} />
            <Route path="/runs" element={<RunHistoryPage />} />
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