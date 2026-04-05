import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './router';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import CreateInvoicePage from './pages/CreateInvoicePage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import AuditLogPage from './pages/AuditLogPage';
import AdminPage from './pages/AdminPage';
import CreatePaymentPage from './pages/CreatePaymentPage';
import DocsPage from './pages/DocsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/docs" element={<DocsPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route
          path="/invoices/create"
          element={
            <ProtectedRoute requiredPermission="invoice:create">
              <CreateInvoicePage />
            </ProtectedRoute>
          }
        />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/new" element={<CreatePaymentPage />} />
        <Route path="/payments/:id" element={<PaymentDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/audit"
          element={
            <ProtectedRoute requiredRole={['BANK_OPERATOR', 'SYSTEM_ADMIN']}>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole={['SYSTEM_ADMIN']}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
