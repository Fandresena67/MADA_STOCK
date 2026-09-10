import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, AppLayout } from '../layouts/AppLayout';
import { SuperAdminRoute, SuperAdminLayout } from '../layouts/SuperAdminLayout';

const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const DashboardPlaceholder = lazy(() => import('../pages/DashboardPlaceholder'));
const CategoriesPage = lazy(() => import('../pages/CategoriesPage'));
const ProductsPage = lazy(() => import('../pages/ProductsPage'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const MovementsPage = lazy(() => import('../pages/MovementsPage'));
const SuppliersPage = lazy(() => import('../pages/SuppliersPage'));
const CustomersPage = lazy(() => import('../pages/CustomersPage'));
const PurchasesPage = lazy(() => import('../pages/PurchasesPage'));
const PurchaseDetail = lazy(() => import('../pages/PurchaseDetail'));
const SalesPage = lazy(() => import('../pages/SalesPage'));
const SaleDetail = lazy(() => import('../pages/SaleDetail'));
const InvoicesPage = lazy(() => import('../pages/InvoicesPage'));
const InvoiceDetail = lazy(() => import('../pages/InvoiceDetail'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const SuperDashboard = lazy(() => import('../pages/SuperDashboard'));
const SuperCompanies = lazy(() => import('../pages/SuperCompanies'));
const SuperUsers = lazy(() => import('../pages/SuperUsers'));
const SuperAudit = lazy(() => import('../pages/SuperAudit'));

function PageFallback() {
  return <p className="p-8 text-sm text-slate-500" role="status">Chargement de la page…</p>;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<DashboardPlaceholder />} />
              <Route path="/app/products" element={<ProductsPage />} />
              <Route path="/app/categories" element={<CategoriesPage />} />
              <Route path="/app/inventory" element={<InventoryPage />} />
              <Route path="/app/movements" element={<MovementsPage />} />
              <Route path="/app/suppliers" element={<SuppliersPage />} />
              <Route path="/app/customers" element={<CustomersPage />} />
              <Route path="/app/purchases" element={<PurchasesPage />} />
              <Route path="/app/purchases/:id" element={<PurchaseDetail />} />
              <Route path="/app/sales" element={<SalesPage />} />
              <Route path="/app/sales/:id" element={<SaleDetail />} />
              <Route path="/app/invoices" element={<InvoicesPage />} />
              <Route path="/app/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/app/dashboard" element={<DashboardPage />} />
              <Route path="/app/reports" element={<ReportsPage />} />
              <Route path="/app/alerts" element={<AlertsPage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route element={<SuperAdminRoute />}>
            <Route element={<SuperAdminLayout />}>
              <Route path="/superadmin/dashboard" element={<SuperDashboard />} />
              <Route path="/superadmin/companies" element={<SuperCompanies />} />
              <Route path="/superadmin/users" element={<SuperUsers />} />
              <Route path="/superadmin/audit" element={<SuperAudit />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
