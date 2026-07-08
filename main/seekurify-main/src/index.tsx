import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./AppRoutes.tsx"; // Contains your <Routes>
import SecurityAlert from "./components/SecurityAlerts.tsx";
import ToastBridge from "./components/ToastBridge.tsx";
import "../src/index.css"; // Tailwind CSS import
createRoot(document.getElementById("app") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SecurityAlert userId={localStorage.getItem("userId") || ""} />
              <ToastBridge />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
