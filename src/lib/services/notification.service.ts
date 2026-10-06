import { apiClient } from "@/lib/api-client";

/**
 * Modul 6 — Notifikasi, Reminder & Escalation Engine.
 * Endpoint backend (Domain 9):
 *   GET  /api/v1/notifications
 *   PUT  /api/v1/notifications/:id/read
 *   GET  /api/v1/admin/notification-templates
 *   POST /api/v1/admin/notification-templates
 *   POST /api/v1/admin/escalation/run-check
 */

export interface BackendNotificationTemplate {
  id?: string;
  code?: string;
  channel?: string;
  subject_template?: string;
  body_template?: string;
}

export interface BackendNotification {
  id: string;
  template_id?: string | null;
  user_id?: string | null;
  patient_id?: string | null;
  related_type?: string | null;
  related_id?: string | null;
  status: "QUEUED" | "SENT" | "FAILED" | "READ" | string;
  scheduled_at?: string;
  created_at?: string;
  template?: BackendNotificationTemplate | null;
  deliveries?: Array<Record<string, unknown>>;
}

export const notificationService = {
  async getAll(): Promise<BackendNotification[]> {
    return apiClient.get<BackendNotification[]>("/notifications");
  },

  async markAsRead(id: string): Promise<unknown> {
    return apiClient.put(`/notifications/${id}/read`);
  },

  async getTemplates(): Promise<unknown[]> {
    return apiClient.get("/admin/notification-templates");
  },

  async createTemplate(body: {
    code: string;
    channel: string;
    subjectTemplate: string;
    bodyTemplate: string;
  }): Promise<unknown> {
    return apiClient.post("/admin/notification-templates", body);
  },

  async runEscalationCheck(): Promise<{
    evaluatedCount?: number;
    escalatedCount?: number;
  }> {
    return apiClient.post("/admin/escalation/run-check");
  },
};
