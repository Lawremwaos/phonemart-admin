import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from "react-router-dom";
import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import InventoryManagement from "./pages/InventoryManagement";
import Sales from "./pages/Sales";
import RepairSales from "./pages/RepairSales";
import ReceiptView from "./pages/ReceiptView";
import DailyReport from "./pages/DailyReport";
import Purchases from "./pages/Purchases";
import Exchange from "./pages/Exchange";
import SupplierManagement from "./pages/SupplierManagement";
import AdminSettings from "./pages/AdminSettings";
import StockExchangeReport from "./pages/StockExchangeReport";
import PendingCollections from "./pages/PendingCollections";
import PendingPaymentApproval from "./pages/PendingPaymentApproval";
import TodaysSalesReport from "./pages/TodaysSalesReport";
import CostOfParts from "./pages/CostOfParts";
import Returns from "./pages/Returns";
import StockAllocation from "./pages/StockAllocation";
import AdminCustomerManagement from "./pages/AdminCustomerManagement";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useShop } from "./context/ShopContext";

function AppContent() {
  const { isAuthenticated, currentUser, logout } = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [repairMenuOpen, setRepairMenuOpen] = useState(true);
  const [accessoriesMenuOpen, setAccessoriesMenuOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - Fixed on desktop, responsive on mobile */}
      <nav className="fixed md:static left-0 top-0 h-full w-64 bg-gray-900 text-white p-6 z-10">
        <h3 className="text-xl font-bold mb-6">PHONEMART</h3>
        <div className="mb-4 p-2 bg-gray-800 rounded">
          <p className="text-xs text-gray-400">Logged in as</p>
          <p className="text-sm font-semibold">{currentUser?.name}</p>
          <p className="text-xs text-gray-400 capitalize">{currentUser?.roles.join(', ')}</p>
        </div>
        <ul className="space-y-2 mb-6">
          {/* Dashboard */}
          <li>
            <Link 
              to="/" 
              className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                location.pathname === '/' ? 'bg-gray-800' : ''
              }`}
            >
              Dashboard
            </Link>
          </li>

          {/* Repair Section */}
          <li>
            <button
              onClick={() => setRepairMenuOpen(!repairMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-800 transition-colors"
            >
              <span className="font-semibold">Repair</span>
              <span>{repairMenuOpen ? '▼' : '▶'}</span>
            </button>
            {repairMenuOpen && (
              <ul className="ml-4 mt-1 space-y-1">
                <li>
                  <Link 
                    to="/repair-sales" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/repair-sales' ? 'bg-gray-800' : ''
                    }`}
                  >
                    Repair Sale
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/pending-collections/pending-payment" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname.includes('/pending-collections/pending-payment') ? 'bg-gray-800' : ''
                    }`}
                  >
                    Pending Payment
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/pending-collections/fully-paid" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname.includes('/pending-collections/fully-paid') ? 'bg-gray-800' : ''
                    }`}
                  >
                    Fully Paid
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/cost-of-parts" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/cost-of-parts' ? 'bg-gray-800' : ''
                    }`}
                  >
                    Cost of Parts
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/returns" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/returns' ? 'bg-gray-800' : ''
                    }`}
                  >
                    Returns & Warranty
                  </Link>
                </li>
              </ul>
            )}
          </li>

          {/* Accessories Section */}
          <li>
            <button
              onClick={() => setAccessoriesMenuOpen(!accessoriesMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-800 transition-colors"
            >
              <span className="font-semibold">Accessories</span>
              <span>{accessoriesMenuOpen ? '▼' : '▶'}</span>
            </button>
            {accessoriesMenuOpen && (
              <ul className="ml-4 mt-1 space-y-1">
                <li>
                  <Link 
                    to="/sales" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/sales' ? 'bg-gray-800' : ''
                    }`}
                  >
                    Accessories Sale
                  </Link>
                </li>
                {currentUser?.roles.includes('admin') && (
                  <li>
                    <Link 
                      to="/purchases" 
                      className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                        location.pathname === '/purchases' ? 'bg-gray-800' : ''
                      }`}
                    >
                      Purchase
                    </Link>
                  </li>
                )}
                <li>
                  <Link 
                    to="/stock-allocation" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/stock-allocation' ? 'bg-gray-800' : ''
                    }`}
                  >
                    {currentUser?.roles.includes('admin') ? 'Stock Allocation' : 'My Stock & Requests'}
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/exchange" 
                    className={`block px-3 py-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                      location.pathname === '/exchange' ? 'bg-gray-800' : ''
                    }`}
                  >
                    Exchange
                  </Link>
                </li>
              </ul>
            )}
          </li>

          {/* Other Menu Items */}
          <li>
            <Link 
              to="/suppliers" 
              className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                location.pathname === '/suppliers' ? 'bg-gray-800' : ''
              }`}
            >
              Suppliers
            </Link>
          </li>
          <li>
            <Link 
              to="/inventory" 
              className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                location.pathname === '/inventory' ? 'bg-gray-800' : ''
              }`}
            >
              Inventory
            </Link>
          </li>
          {currentUser?.roles.includes('admin') && (
            <li>
              <Link 
                to="/daily-report" 
                className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                  location.pathname === '/daily-report' ? 'bg-gray-800' : ''
                }`}
              >
                Daily Reports
              </Link>
            </li>
          )}
          <li>
            <Link 
              to="/todays-sales-report" 
              className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                location.pathname === '/todays-sales-report' ? 'bg-gray-800' : ''
              }`}
            >
              Today's Sales Report
            </Link>
          </li>
          {currentUser?.roles.includes('admin') && (
            <>
              <li>
                <Link 
                  to="/admin-settings" 
                  className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                    location.pathname === '/admin-settings' ? 'bg-gray-800' : ''
                  }`}
                >
                  Admin Settings
                </Link>
              </li>
              <li>
                <Link 
                  to="/admin-customer-management" 
                  className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                    location.pathname === '/admin-customer-management' ? 'bg-gray-800' : ''
                  }`}
                >
                  Customer Management
                </Link>
              </li>
              <li>
                <Link 
                  to="/stock-exchange-report" 
                  className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                    location.pathname === '/stock-exchange-report' ? 'bg-gray-800' : ''
                  }`}
                >
                  Stock Exchange Report
                </Link>
              </li>
            </>
          )}
          {!currentUser?.roles.includes('admin') && (
            <li>
              <Link 
                to="/stock-exchange-report" 
                className={`block px-3 py-2 rounded hover:bg-gray-800 transition-colors ${
                  location.pathname === '/stock-exchange-report' ? 'bg-gray-800' : ''
                }`}
              >
                Stock Exchange Report
              </Link>
            </li>
          )}
        </ul>
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </nav>

      {/* Main content - Responsive with sidebar offset */}
      <main className="flex-1 md:ml-0 ml-64 p-4 md:p-6 min-h-screen w-full md:w-auto">
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory/manage"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <InventoryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/purchases"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Purchases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-allocation"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <StockAllocation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exchange"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <Exchange />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <SupplierManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/returns"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <Returns />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <Sales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/repair-sales"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <RepairSales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receipt"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <ReceiptView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-report"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DailyReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-customer-management"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminCustomerManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-exchange-report"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <StockExchangeReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-collections/:filterType?"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <PendingCollections />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pending-payment-approval"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <PendingPaymentApproval />
              </ProtectedRoute>
            }
          />
          <Route
            path="/todays-sales-report"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <TodaysSalesReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cost-of-parts"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <CostOfParts />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
