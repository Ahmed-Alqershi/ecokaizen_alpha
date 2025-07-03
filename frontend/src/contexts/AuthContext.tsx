import { createContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextProps {
  username: string | null;
  avatar: string | null;
  login: (name: string, avatar: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextProps>({
  username: null,
  avatar: null,
  login: () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const storedName = localStorage.getItem('username');
    const storedAvatar = localStorage.getItem('avatar');
    if (storedName) {
      setUsername(storedName);
    }
    if (storedAvatar) {
      setAvatar(storedAvatar);
    }
  }, []);

  const login = (name: string, userAvatar: string) => {
    localStorage.setItem('username', name);
    localStorage.setItem('avatar', userAvatar);
    setUsername(name);
    setAvatar(userAvatar);
  };

  const logout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('avatar');
    setUsername(null);
    setAvatar(null);
  };

  return (
    <AuthContext.Provider value={{ username, avatar, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
