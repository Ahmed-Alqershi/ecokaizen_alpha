import { useState } from 'react';
import { registerUser } from '../utils/api';
import { Link, useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerUser(username, password);
      navigate('/login');
    } catch (err: any) {
      setError(err?.error || 'Signup failed');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 card">
      <h2 className="text-2xl font-bold text-center mb-6">Sign Up</h2>
      {error && <p className="text-warning mb-4 text-center">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          className="input w-full"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          className="input w-full"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-primary w-full">
          Sign Up
        </button>
      </form>
      <p className="text-sm text-center mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-primary hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
};

export default SignupPage;
