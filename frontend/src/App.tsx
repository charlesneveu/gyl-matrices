
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { LayoutDashboard, FileSpreadsheet } from 'lucide-react'
import Catalog from './pages/Catalog'
import CreateOffer from './pages/CreateOffer'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <span className="text-xl font-bold text-primary-600">MatrixGen</span>
                </div>
                <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    to="/"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 mr-2" />
                    Catalogue
                  </Link>
                  <Link
                    to="/create-offer"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Création d'Offre
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/create-offer" element={<CreateOffer />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
