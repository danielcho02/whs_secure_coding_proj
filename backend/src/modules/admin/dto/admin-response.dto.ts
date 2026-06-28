import {
  ProductStatus,
  ReportStatus,
  ReportType,
  Role,
  UserStatus,
} from '@prisma/client';

export interface AdminPublicUser {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  trustScore: number;
  completedTx: number;
}

export interface AdminUserResponse extends AdminPublicUser {
  role: Role;
  status: UserStatus;
  bio?: string | null;
  createdAt?: Date;
}

export interface AdminProductResponse {
  id: string;
  title: string;
  description?: string;
  price: number;
  category: string;
  region?: string | null;
  status: ProductStatus;
  isHidden: boolean;
  createdAt: Date;
  seller?: AdminPublicUser;
}

export interface AdminReportResponse {
  id: string;
  reporter: AdminPublicUser;
  targetType: ReportType;
  targetId: string;
  target: unknown;
  reason: string;
  description: string | null;
  status: ReportStatus;
  adminNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface AdminLogResponse {
  id: string;
  actor: AdminPublicUser;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  createdAt: Date;
}

export interface PaginatedAdminResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
