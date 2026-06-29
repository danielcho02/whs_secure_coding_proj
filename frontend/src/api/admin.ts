import { apiClient } from './client';
import type { ProductStatus } from './products';
import type { ReportStatus, ReportTargetType } from './reports';
import type { UserRole, UserStatus } from '../auth/authTypes';

export interface AdminPublicUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface AdminUser extends AdminPublicUser {
  role: UserRole;
  status: UserStatus;
  bio?: string | null;
  createdAt?: string;
}

export interface AdminProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  region?: string | null;
  status: ProductStatus;
  isHidden: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
  seller?: AdminPublicUser;
}

export interface AdminReport {
  id: string;
  reporter: AdminPublicUser;
  targetType: ReportTargetType;
  targetId: string;
  target: unknown;
  reason: string;
  description: string | null;
  status: ReportStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminLog {
  id: string;
  actor: AdminPublicUser;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: string;
}

export interface AdminPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AdminListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  role?: string;
  targetType?: string;
  isHidden?: boolean;
}

export interface AdminReasonPayload {
  reason?: string;
}

export interface UpdateAdminReportPayload {
  status: Exclude<ReportStatus, 'PENDING'>;
  adminNote?: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function listAdminReports(
  params: AdminListParams = {},
): Promise<AdminPage<AdminReport>> {
  const response = await apiClient.get<ApiSuccess<AdminPage<AdminReport>>>(
    '/admin/reports',
    { params },
  );
  return response.data.data;
}

export async function getAdminReport(reportId: string): Promise<AdminReport> {
  const response = await apiClient.get<ApiSuccess<AdminReport>>(
    `/admin/reports/${reportId}`,
  );
  return response.data.data;
}

export async function updateAdminReportStatus(
  reportId: string,
  payload: UpdateAdminReportPayload,
): Promise<AdminReport> {
  const response = await apiClient.patch<ApiSuccess<AdminReport>>(
    `/admin/reports/${reportId}/status`,
    payload,
  );
  return response.data.data;
}

export async function listAdminProducts(
  params: AdminListParams = {},
): Promise<AdminPage<AdminProduct>> {
  const response = await apiClient.get<ApiSuccess<AdminPage<AdminProduct>>>(
    '/admin/products',
    { params },
  );
  return response.data.data;
}

export async function hideAdminProduct(
  productId: string,
  payload: AdminReasonPayload,
): Promise<AdminProduct> {
  const response = await apiClient.patch<ApiSuccess<AdminProduct>>(
    `/admin/products/${productId}/hide`,
    payload,
  );
  return response.data.data;
}

export async function restoreAdminProduct(
  productId: string,
  payload: AdminReasonPayload,
): Promise<AdminProduct> {
  const response = await apiClient.patch<ApiSuccess<AdminProduct>>(
    `/admin/products/${productId}/restore`,
    payload,
  );
  return response.data.data;
}

export async function listAdminUsers(
  params: AdminListParams = {},
): Promise<AdminPage<AdminUser>> {
  const response = await apiClient.get<ApiSuccess<AdminPage<AdminUser>>>(
    '/admin/users',
    { params },
  );
  return response.data.data;
}

export async function suspendAdminUser(
  userId: string,
  payload: AdminReasonPayload,
): Promise<AdminUser> {
  const response = await apiClient.patch<ApiSuccess<AdminUser>>(
    `/admin/users/${userId}/suspend`,
    payload,
  );
  return response.data.data;
}

export async function restoreAdminUser(
  userId: string,
  payload: AdminReasonPayload,
): Promise<AdminUser> {
  const response = await apiClient.patch<ApiSuccess<AdminUser>>(
    `/admin/users/${userId}/restore`,
    payload,
  );
  return response.data.data;
}

export async function listAdminLogs(
  params: AdminListParams = {},
): Promise<AdminPage<AdminLog>> {
  const response = await apiClient.get<ApiSuccess<AdminPage<AdminLog>>>(
    '/admin/logs',
    { params },
  );
  return response.data.data;
}
