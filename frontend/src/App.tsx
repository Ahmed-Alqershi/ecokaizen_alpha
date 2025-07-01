import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './screens/HomePage';
import ModelBuilderPage from './screens/ModelBuilderPage';
import TableTestPage from './screens/TableTestPage';
import LoginPage from './screens/LoginPage';
import SignupPage from './screens/SignupPage';
import './styles/index.css';

const App = () => {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/model-builder" element={<ModelBuilderPage />} />
            <Route path="/table-test" element={<TableTestPage />} />
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