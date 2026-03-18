import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { LayoutDashboard, FileSpreadsheet, LogOut } from 'lucide-react'
import Catalog from './pages/Catalog'
import CreateOffer from './pages/CreateOffer'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Login } from './pages/Login'

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const Navigation = () => {
  const { isAuthenticated, logout } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-primary-600">MatrixGen</span>
            </div>
            <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
              <Link to="/" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Catalogue
              </Link>
              <Link to="/create-offer" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Création d'Offre
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <button onClick={logout} className="text-gray-500 hover:text-red-600 flex items-center text-sm font-medium transition-colors">
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navigation />
          <main className="flex-1 w-full mx-auto py-6">
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
              <Route path="/create-offer" element={<ProtectedRoute><CreateOffer /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
