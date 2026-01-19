import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import { InventoryProvider } from "./context/InventoryContext";
import { SalesProvider } from "./context/SalesContext";
import { RepairProvider } from "./context/RepairContext";
import { PaymentProvider } from "./context/PaymentContext";
import { SupplierProvider } from "./context/SupplierContext";
import { SupplierDebtProvider } from "./context/SupplierDebtContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShopProvider>
        <PaymentProvider>
          <SalesProvider>
            <RepairProvider>
              <InventoryProvider>
                <SupplierProvider>
                  <SupplierDebtProvider>
                    <App />
                  </SupplierDebtProvider>
                </SupplierProvider>
              </InventoryProvider>
            </RepairProvider>
          </SalesProvider>
        </PaymentProvider>
      </ShopProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
