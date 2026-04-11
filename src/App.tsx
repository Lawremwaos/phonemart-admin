import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import InventoryManagement from "./pages/InventoryManagement";
import Sales from "./pages/Sales";
import RepairSales from "./pages/RepairSales";
import ReceiptView from "./pages/ReceiptView";
import DailyReport from "./pages/DailyReport";
import AdminDailyFinancialReport from "./pages/AdminDailyFinancialReport";
import Purchases from "./pages/Purchases";
import Exchange from "./pages/Exchange";
import SupplierManagement from "./pages/SupplierManagement";
import AdminSettings from "./pages/AdminSettings";
import StockExchangeReport from "./pages/StockExchangeReport";
import PendingCollections from "./pages/PendingCollections";
import PendingPaymentApproval from "./pages/PendingPaymentApproval";
import RepairReport from "./pages/RepairReport";
import AccessoriesReport from "./pages/AccessoriesReport";
import CostOfParts from "./pages/CostOfParts";
import Returns from "./pages/Returns";
import StockAllocation from "./pages/StockAllocation";
import AdminCustomerManagement from "./pages/AdminCustomerManagement";
import Repairs from "./pages/Repairs";
import ProcurementReview from "./pages/ProcurementReview";
import StaffPurchases from "./pages/StaffPurchases";
import RepairSaleProfit from "./pages/RepairSaleProfit";
import AccessoryProfit from "./pages/AccessoryProfit";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import { useShop } from "./context/ShopContext";

function AppContent() {
  const { isAuthenticated } = useShop();

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
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
              <ProtectedRoute allowedRoles={['admin', 'technician']}>
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
            path="/repairs"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <Repairs />
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
            path="/staff-purchases"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <StaffPurchases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/procurement-review"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ProcurementReview />
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
            path="/admin-daily-financial"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDailyFinancialReport />
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
            path="/repair-report"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <RepairReport />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accessories-report"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <AccessoriesReport />
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
          <Route
            path="/repair-sale-profit"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <RepairSaleProfit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accessory-profit"
            element={
              <ProtectedRoute allowedRoles={['admin', 'technician', 'manager']}>
                <AccessoryProfit />
              </ProtectedRoute>
            }
          />
        </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
