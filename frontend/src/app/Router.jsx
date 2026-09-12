import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute, AppLayout } from '../layouts/AppLayout';
import { SuperAdminRoute, SuperAdminLayout } from '../layouts/SuperAdminLayout';
import { lazyRetry } from './routeLoader';
import { RouteErrorBoundary } from '../components/ErrorBoundary';

const LoginPage = lazyRetry(() => import('../pages/LoginPage'));
const RegisterPage = lazyRetry(() => import('../pages/RegisterPage'));
const DashboardPlaceholder = lazyRetry(() => import('../pages/DashboardPlaceholder'));
const CategoriesPage = lazyRetry(() => import('../pages/CategoriesPage'));
const ProductsPage = lazyRetry(() => import('../pages/ProductsPage'));
const ProductDetailPage = lazyRetry(() => import('../pages/ProductDetailPage'));
const InventoryPage = lazyRetry(() => import('../pages/InventoryPage'));
const MovementsPage = lazyRetry(() => import('../pages/MovementsPage'));
const SuppliersPage = lazyRetry(() => import('../pages/SuppliersPage'));
const CustomersPage = lazyRetry(() => import('../pages/CustomersPage'));
const PurchasesPage = lazyRetry(() => import('../pages/PurchasesPage'));
const PurchaseDetail = lazyRetry(() => import('../pages/PurchaseDetail'));
const SalesPage = lazyRetry(() => import('../pages/SalesPage'));
const SaleDetail = lazyRetry(() => import('../pages/SaleDetail'));
const InvoicesPage = lazyRetry(() => import('../pages/InvoicesPage'));
const InvoiceDetail = lazyRetry(() => import('../pages/InvoiceDetail'));
const VerifyInvoicePage = lazyRetry(() => import('../pages/VerifyInvoicePage'));
const DashboardPage = lazyRetry(() => import('../pages/DashboardPage'));
const ReportsPage = lazyRetry(() => import('../pages/ReportsPage'));
const AlertsPage = lazyRetry(() => import('../pages/AlertsPage'));
const NotificationsPage = lazyRetry(() => import('../pages/NotificationsPage'));
const ProfilePage = lazyRetry(() => import('../pages/ProfilePage'));
const UsersPage = lazyRetry(() => import('../pages/UsersPage'));
const SettingsPage = lazyRetry(() => import('../pages/SettingsPage'));
const SuperDashboard = lazyRetry(() => import('../pages/SuperDashboard'));
const SuperCompanies = lazyRetry(() => import('../pages/SuperCompanies'));
const SuperUsers = lazyRetry(() => import('../pages/SuperUsers'));
const SuperAudit = lazyRetry(() => import('../pages/SuperAudit'));

function PageFallback() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white px-6 py-16" role="status" aria-live="polite">
      <Loader2 size={28} aria-hidden="true" className="animate-spin text-primary-600" />
      <p className="mt-3 text-sm font-medium text-slate-500">Chargement de la page…</p>
    </div>
  );
}

export default function Router() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify/invoice/:token" element={<VerifyInvoicePage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/app" element={<DashboardPlaceholder />} />
                <Route path="/app/products" element={<ProductsPage />} />
                <Route path="/app/products/:id" element={<ProductDetailPage />} />
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
                <Route path="/app/notifications" element={<NotificationsPage />} />
                <Route path="/app/profile" element={<ProfilePage />} />
                <Route path="/app/users" element={<UsersPage />} />
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
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
