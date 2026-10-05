import { apiClient } from "@/lib/api-client";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export const notificationService = {
  async getAll(): Promise<AppNotification[]> {
    return apiClient.get<AppNotification[]>("/notifications");
  },

  async markAsRead(id: string): Promise<{ success: boolean }> {
    return apiClient.put(`/notifications/${id}/read`, {});
  },
};
