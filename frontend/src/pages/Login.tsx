import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, LogIn, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export const Login: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        login(data.token);
      } else {
        setError(data.error || 'Mot de passe incorrect');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-3xl opacity-50 pointer-events-none" />

      <div className="max-w-md w-full mx-auto p-8 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden backdrop-blur-sm border border-white/50">
          <div className="p-8">
            <div className="flex justify-center mb-8">
              <div className="h-16 w-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                <Lock className="h-8 w-8 text-white transform rotate-6" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">Accès Restreint</h2>
            <p className="text-center text-gray-500 mb-8 font-medium">Portail Matrice E-Commerce</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe de l'équipe</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50/50 transition-colors"
                    placeholder="Entrez le mot de passe"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-gray-900 hover:bg-gray-800 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Se connecter
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        
        <p className="text-center text-sm text-gray-400 mt-8">
          Usage interne exclusif
        </p>
      </div>
    </div>
  );
};
