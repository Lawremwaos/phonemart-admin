import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ShopProvider } from "./context/ShopContext";
import { InventoryProvider } from "./context/InventoryContext";
import { SalesProvider } from "./context/SalesContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShopProvider>
        <SalesProvider>
          <InventoryProvider>
            <App />
          </InventoryProvider>
        </SalesProvider>
      </ShopProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
