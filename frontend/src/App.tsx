import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './screens/HomePage';
import ModelBuilderPage from './screens/ModelBuilderPage';
import TableTestPage from './screens/TableTestPage';
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
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
};

export default App;