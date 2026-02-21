import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
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
import Returns from "./pages/Returns";
import StockAllocation from "./pages/StockAllocation";
import AdminCustomerManagement from "./pages/AdminCustomerManagement";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useShop } from "./context/ShopContext";

function AppContent() {
  const { isAuthenticated, currentUser, logout } = useShop();
  const navigate = useNavigate();

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
        <ul className="space-y-4 mb-6">
          <li>
            <Link to="/" className="block hover:text-gray-300 transition-colors">Dashboard</Link>
          </li>
          <li>
            <Link to="/repair-sales" className="block hover:text-gray-300 transition-colors">Repair Sales</Link>
          </li>
          <li>
            <Link to="/sales" className="block hover:text-gray-300 transition-colors">Accessories Sales</Link>
          </li>
          <li>
            <Link to="/pending-collections/all" className="block hover:text-gray-300 transition-colors">All</Link>
          </li>
          <li>
            <Link to="/pending-collections/pending-payment" className="block hover:text-gray-300 transition-colors">Pending Payment</Link>
          </li>
          <li>
            <Link to="/pending-collections/ready-for-collection" className="block hover:text-gray-300 transition-colors">Ready for Collection</Link>
          </li>
          <li>
            <Link to="/pending-collections/fully-paid" className="block hover:text-gray-300 transition-colors">Fully Paid</Link>
          </li>
          {currentUser?.roles.includes('admin') && (
            <li>
              <Link to="/purchases" className="block hover:text-gray-300 transition-colors">Purchases</Link>
            </li>
          )}
          <li>
            <Link to="/stock-allocation" className="block hover:text-gray-300 transition-colors">Stock Allocation</Link>
          </li>
          <li>
            <Link to="/suppliers" className="block hover:text-gray-300 transition-colors">Suppliers</Link>
          </li>
          <li>
            <Link to="/returns" className="block hover:text-gray-300 transition-colors">Returns & Warranty</Link>
          </li>
          <li>
            <Link to="/inventory" className="block hover:text-gray-300 transition-colors">Inventory</Link>
          </li>
          {currentUser?.roles.includes('admin') && (
            <li>
              <Link to="/daily-report" className="block hover:text-gray-300 transition-colors">Daily Reports</Link>
            </li>
          )}
          <li>
            <Link to="/todays-sales-report" className="block hover:text-gray-300 transition-colors">Today's Sales Report</Link>
          </li>
          <li>
            <Link to="/pending-collections/fully-paid" className="block hover:text-gray-300 transition-colors">Fully Paid</Link>
          </li>
          <li>
            <Link to="/exchange" className="block hover:text-gray-300 transition-colors">Exchange</Link>
          </li>
          {currentUser?.roles.includes('admin') && (
            <>
              <li>
                <Link to="/admin-settings" className="block hover:text-gray-300 transition-colors">Admin Settings</Link>
              </li>
              <li>
                <Link to="/admin-customer-management" className="block hover:text-gray-300 transition-colors">Customer Management</Link>
              </li>
              <li>
                <Link to="/stock-exchange-report" className="block hover:text-gray-300 transition-colors">Stock Exchange Report</Link>
              </li>
            </>
          )}
          {!currentUser?.roles.includes('admin') && (
            <li>
              <Link to="/stock-exchange-report" className="block hover:text-gray-300 transition-colors">Stock Exchange Report</Link>
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
