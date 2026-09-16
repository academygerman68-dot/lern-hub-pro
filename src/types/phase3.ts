/** Phase-3 tables (keep in sync with supabase/migrations/20260916120000_*). */

export type PaymentProofStatus = "pending" | "approved" | "rejected";
export type RecordingStatus = "pending" | "ready" | "failed" | "unavailable";
export type OutboxStatus = "queued" | "sent" | "failed" | "skipped";

export type PaymentProof = {
  id: string;
  student_id: string;
  payment_id: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  status: PaymentProofStatus;
  student_note: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MeetingRecording = {
  id: string;
  live_session_id: string | null;
  class_id: string | null;
  teacher_id: string | null;
  title: string;
  storage_bucket: string;
  storage_path: string | null;
  duration_seconds: number | null;
  file_size: number | null;
  mime_type: string | null;
  status: RecordingStatus;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationOutboxRow = {
  id: string;
  channel: "in_app" | "email" | "whatsapp";
  template_key: string;
  recipient_profile_id: string | null;
  recipient_address: string | null;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  idempotency_key: string;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};
