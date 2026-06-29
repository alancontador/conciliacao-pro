import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Dashboard } from "@/pages/Dashboard";
import { Status } from "@/pages/Status";
import { ImportBalancete } from "@/pages/ImportBalancete";
import { ImportRazao } from "@/pages/ImportRazao";
import { Settings } from "@/pages/Settings";
import { Usuarios } from "@/pages/Usuarios";
import { Empresas } from "@/pages/Empresas";
import { Login } from "@/pages/Login";
import { ResetPassword } from "@/pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Rotas protegidas (dentro do Layout) */}
          <Route
            path="/"
            element={
              <ProtectedRoute permission="verDashboard">
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/status"
            element={
              <ProtectedRoute permission="verStatus">
                <Layout><Status /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/import/balancete"
            element={
              <ProtectedRoute permission="importar">
                <Layout><ImportBalancete /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/import/razao"
            element={
              <ProtectedRoute permission="importar">
                <Layout><ImportRazao /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/empresas"
            element={
              <ProtectedRoute>
                <Layout><Empresas /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <ProtectedRoute permission="gerenciarUsuarios">
                <Layout><Usuarios /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            }
          />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
