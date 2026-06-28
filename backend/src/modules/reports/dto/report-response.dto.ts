import { ReportStatus, ReportType } from '@prisma/client';

export interface ReportResponse {
  id: string;
  reporterId: string;
  targetType: ReportType;
  targetId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  adminNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface PaginatedReportsResponse {
  items: ReportResponse[];
  page: number;
  limit: number;
  total: number;
}
