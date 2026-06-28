import { Route, Routes } from 'react-router-dom';
import { AppShell } from './layout/AppShell';
import { AdminRoute } from './routes/AdminRoute';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminHomePage, PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
          <Route element={<NotificationsPage />} path="notifications" />
          <Route
            element={
              <PlaceholderPage
                description="찜한 상품 API 응답이 준비되는 다음 단계에서 사진 중심 목록으로 연결합니다."
                title="찜한 상품을 모아볼 자리입니다"
              />
            }
            path="favorites"
          />
          <Route
            element={
              <PlaceholderPage
                description="채팅 목록과 실시간 메시지는 다음 구현 단계에서 연결합니다."
                title="채팅 화면을 준비 중입니다"
              />
            }
            path="chats"
          />
          <Route
            element={
              <PlaceholderPage
                description="선택한 채팅방의 메시지 UI가 다음 단계에서 이 자리에 열립니다."
                title="채팅방을 준비 중입니다"
              />
            }
            path="chats/:chatId"
          />
          <Route
            element={
              <PlaceholderPage
                description="구매와 판매 거래 상태를 이어서 연결합니다."
                title="거래 내역을 준비 중입니다"
              />
            }
            path="transactions"
          />
          <Route
            element={
              <PlaceholderPage
                description="거래 상세와 안전결제 상태를 다음 단계에서 연결합니다."
                title="거래 상세를 준비 중입니다"
              />
            }
            path="transactions/:transactionId"
          />
          <Route
            element={
              <PlaceholderPage
                description="프로필 수정과 차단 목록을 다음 단계에서 연결합니다."
                title="마이페이지를 준비 중입니다"
              />
            }
            path="me"
          />
          <Route
            element={
              <PlaceholderPage
                description="내 신고 내역과 처리 상태를 실제 API로 연결할 예정입니다."
                title="신고 내역을 준비 중입니다"
              />
            }
            path="reports"
          />

          <Route element={<AdminRoute />}>
            <Route element={<AdminHomePage />} path="admin" />
          </Route>
        </Route>

        <Route element={<NotFoundPage />} path="*" />
      </Route>
    </Routes>
  );
}
