import React, { useState } from 'react';
import { sendContactMessage } from '../utils/api';

const ContactPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sendContactMessage(name, email, message);
      setSent(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      setError(err?.error || 'Unable to send message');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 card animate-fadeInUp">
      {sent ? (
        <p className="text-center text-success font-semibold">
          We received your message and we will get back to you shortly.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="text-2xl font-bold text-center">Contact Us</h1>
          {error && <p className="text-red-600 text-center">{error}</p>}
          <input
            className="input w-full"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input w-full"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <textarea
            className="input w-full h-32"
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="btn btn-primary w-full">
            Send
          </button>
        </form>
      )}
    </div>
  );
};

export default ContactPage;
