import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './app/LoginPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { CustomersPage } from './app/CustomersPage';
import { CustomerDetailPage } from './app/CustomerDetailPage';
import { VehiclesPage } from './app/VehiclesPage';
import { WorkOrdersListPage } from './app/WorkOrdersListPage';
import { WorkOrderCreatePage } from './app/WorkOrderCreatePage';
import { WorkOrderDetailPage } from './app/WorkOrderDetailPage';
import { WorkOrderPrintPage } from './app/WorkOrderPrintPage';
import { CashClosePage } from './app/CashClosePage';
import { UsersPage } from './app/UsersPage';
import { ReportsPage } from './app/ReportsPage';
import { CatalogPage } from './app/CatalogPage';
import { InventoryPage } from './app/InventoryPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="customers" replace />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="customers/:id/vehicles" element={<VehiclesPage />} />
        <Route path="work-orders" element={<WorkOrdersListPage />} />
        <Route path="work-orders/new" element={<WorkOrderCreatePage />} />
        <Route path="work-orders/:id" element={<WorkOrderDetailPage />} />
        <Route path="work-orders/:id/print" element={<WorkOrderPrintPage />} />
        <Route path="cash" element={<CashClosePage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="inventory" element={<InventoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
