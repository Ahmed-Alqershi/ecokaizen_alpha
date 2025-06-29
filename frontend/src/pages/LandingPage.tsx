import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div>
      <nav>
        <div>CGE Made Simple</div>
        <ul>
          <li><a href="#">Home</a></li>
          <li><a href="#">How It Works</a></li>
          <li><a href="#">CGE Templates</a></li>
          <li><a href="#">Pricing</a></li>
          <li><a href="#">Support</a></li>
        </ul>
      </nav>
      <div className="hero">
        <h1>CGE Made Simple</h1>
        <p>Watch a quick demo of a trade shock scenario.</p>
        <video width="480" controls>
          <source src="demo.mp4" type="video/mp4" />
        </video>
        <div>
          <Link to="/sandbox"><button>Try Demo</button></Link>
          <Link to="/signup"><button>Sign Up</button></Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
