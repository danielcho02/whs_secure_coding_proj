import { Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { AdminRoute } from './routes/AdminRoute';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductFormPage } from './pages/ProductFormPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ChatsPage, ChatRoomPage } from './pages/ChatsPage';
import { ReportsPage } from './pages/ReportsPage';
import { BlocksPage } from './pages/BlocksPage';
import {
  PaymentFailPage,
  PaymentSuccessPage,
  TransactionDetailPage,
  TransactionsPage,
} from './pages/TransactionsPage';
import {
  FavoritesPage,
  MePage,
  MyProductsPage,
} from './pages/MePage';
import {
  AdminDashboardPage,
  AdminLogsPage,
  AdminProductsPage,
  AdminReportsPage,
  AdminUsersPage,
} from './pages/AdminPages';

export default function App() {
  return (
    <Routes>
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />

      <Route element={<AppShell />}>
        <Route element={<HomePage />} index />
        <Route element={<HomePage />} path="products" />
        <Route element={<ProductDetailPage />} path="products/:productId" />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProductFormPage mode="create" />} path="products/new" />
          <Route element={<ProductFormPage mode="edit" />} path="products/:productId/edit" />
          <Route element={<NotificationsPage />} path="notifications" />
          <Route element={<FavoritesPage />} path="favorites" />
          <Route element={<ChatsPage />} path="chats" />
          <Route element={<ChatRoomPage />} path="chats/:chatId" />
          <Route element={<TransactionsPage />} path="transactions" />
          <Route element={<TransactionDetailPage />} path="transactions/:transactionId" />
          <Route element={<PaymentSuccessPage />} path="payments/success" />
          <Route element={<PaymentFailPage />} path="payments/fail" />
          <Route element={<PaymentFailPage type="cancel" />} path="payments/cancel" />
          <Route element={<MePage />} path="me" />
          <Route element={<MyProductsPage />} path="me/products" />
          <Route element={<ReportsPage />} path="reports" />
          <Route element={<BlocksPage />} path="blocks" />

          <Route element={<AdminRoute />}>
            <Route element={<AdminDashboardPage />} path="admin" />
            <Route element={<AdminReportsPage />} path="admin/reports" />
            <Route element={<AdminProductsPage />} path="admin/products" />
            <Route element={<AdminUsersPage />} path="admin/users" />
            <Route element={<AdminLogsPage />} path="admin/logs" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
