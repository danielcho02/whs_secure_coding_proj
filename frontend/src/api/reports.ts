import { apiClient } from './client';

export type ReportTargetType = 'USER' | 'PRODUCT' | 'CHAT';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ReportPage {
  items: Report[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
}

export interface ListMyReportsParams {
  page?: number;
  limit?: number;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function createReport(
  payload: CreateReportPayload,
): Promise<Report> {
  const response = await apiClient.post<ApiSuccess<Report>>('/reports', payload);
  return response.data.data;
}

export async function listMyReports(
  params: ListMyReportsParams = {},
): Promise<ReportPage> {
  const response = await apiClient.get<ApiSuccess<ReportPage>>('/reports/me', {
    params,
  });
  return response.data.data;
}
