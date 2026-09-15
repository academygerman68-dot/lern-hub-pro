export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_submissions: {
        Row: {
          assignment_id: string;
          content_text: string | null;
          created_at: string;
          feedback: string | null;
          file_bucket: string | null;
          file_path: string | null;
          graded_at: string | null;
          graded_by: string | null;
          id: string;
          score: number | null;
          status: Database["public"]["Enums"]["submission_status"];
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          assignment_id: string;
          content_text?: string | null;
          created_at?: string;
          feedback?: string | null;
          file_bucket?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          score?: number | null;
          status?: Database["public"]["Enums"]["submission_status"];
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          assignment_id?: string;
          content_text?: string | null;
          created_at?: string;
          feedback?: string | null;
          file_bucket?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          score?: number | null;
          status?: Database["public"]["Enums"]["submission_status"];
          student_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey";
            columns: ["graded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: {
          archived_at: string | null;
          attachment_bucket: string | null;
          attachment_path: string | null;
          class_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_at: string | null;
          id: string;
          instructions: string | null;
          max_score: number;
          status: Database["public"]["Enums"]["assignment_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          attachment_bucket?: string | null;
          attachment_path?: string | null;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          instructions?: string | null;
          max_score?: number;
          status?: Database["public"]["Enums"]["assignment_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          attachment_bucket?: string | null;
          attachment_path?: string | null;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          instructions?: string | null;
          max_score?: number;
          status?: Database["public"]["Enums"]["assignment_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_records: {
        Row: {
          created_at: string;
          id: string;
          mark: Database["public"]["Enums"]["attendance_mark"];
          note: string | null;
          session_id: string;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mark?: Database["public"]["Enums"]["attendance_mark"];
          note?: string | null;
          session_id: string;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mark?: Database["public"]["Enums"]["attendance_mark"];
          note?: string | null;
          session_id?: string;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "attendance_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance_sessions: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          notes: string | null;
          session_date: string;
          starts_at: string | null;
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          session_date?: string;
          starts_at?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          notes?: string | null;
          session_date?: string;
          starts_at?: string | null;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          new_data: Json | null;
          old_data: Json | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          new_data?: Json | null;
          old_data?: Json | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          new_data?: Json | null;
          old_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          archived_at: string | null;
          capacity: number;
          created_at: string;
          end_date: string | null;
          id: string;
          level_id: string;
          name: string;
          room: string | null;
          schedule_label: string | null;
          start_date: string | null;
          status: Database["public"]["Enums"]["class_status"];
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          capacity?: number;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          level_id: string;
          name: string;
          room?: string | null;
          schedule_label?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["class_status"];
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          capacity?: number;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          level_id?: string;
          name?: string;
          room?: string | null;
          schedule_label?: string | null;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["class_status"];
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          level_id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          level_id: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          level_id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          class_id: string;
          created_at: string;
          end_date: string | null;
          id: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_answer_keys: {
        Row: {
          correct_values: string[];
          created_at: string;
          question_id: string;
          updated_at: string;
        };
        Insert: {
          correct_values?: string[];
          created_at?: string;
          question_id: string;
          updated_at?: string;
        };
        Update: {
          correct_values?: string[];
          created_at?: string;
          question_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_answer_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "exam_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_answers: {
        Row: {
          answer: Json;
          attempt_id: string;
          created_at: string;
          flagged: boolean;
          id: string;
          is_correct: boolean | null;
          points_awarded: number | null;
          question_id: string;
          updated_at: string;
        };
        Insert: {
          answer?: Json;
          attempt_id: string;
          created_at?: string;
          flagged?: boolean;
          id?: string;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          question_id: string;
          updated_at?: string;
        };
        Update: {
          answer?: Json;
          attempt_id?: string;
          created_at?: string;
          flagged?: boolean;
          id?: string;
          is_correct?: boolean | null;
          points_awarded?: number | null;
          question_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey";
            columns: ["attempt_id"];
            isOneToOne: false;
            referencedRelation: "exam_attempts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "exam_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_attempts: {
        Row: {
          created_at: string;
          exam_id: string;
          expires_at: string;
          id: string;
          max_score: number | null;
          percentage: number | null;
          score: number | null;
          skill_breakdown: Json;
          started_at: string;
          status: Database["public"]["Enums"]["exam_attempt_status"];
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exam_id: string;
          expires_at: string;
          id?: string;
          max_score?: number | null;
          percentage?: number | null;
          score?: number | null;
          skill_breakdown?: Json;
          started_at?: string;
          status?: Database["public"]["Enums"]["exam_attempt_status"];
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exam_id?: string;
          expires_at?: string;
          id?: string;
          max_score?: number | null;
          percentage?: number | null;
          score?: number | null;
          skill_breakdown?: Json;
          started_at?: string;
          status?: Database["public"]["Enums"]["exam_attempt_status"];
          student_id?: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_question_options: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          question_id: string;
          sort_order: number;
          value: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label: string;
          question_id: string;
          sort_order?: number;
          value: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          question_id?: string;
          sort_order?: number;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "exam_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_questions: {
        Row: {
          created_at: string;
          id: string;
          media_bucket: string | null;
          media_path: string | null;
          metadata: Json;
          points: number;
          prompt: string;
          section_id: string;
          sort_order: number;
          type: Database["public"]["Enums"]["exam_question_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          media_bucket?: string | null;
          media_path?: string | null;
          metadata?: Json;
          points?: number;
          prompt: string;
          section_id: string;
          sort_order?: number;
          type: Database["public"]["Enums"]["exam_question_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          media_bucket?: string | null;
          media_path?: string | null;
          metadata?: Json;
          points?: number;
          prompt?: string;
          section_id?: string;
          sort_order?: number;
          type?: Database["public"]["Enums"]["exam_question_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_questions_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "exam_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_sections: {
        Row: {
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          exam_id: string;
          id: string;
          max_score: number;
          skill: Database["public"]["Enums"]["exam_skill"];
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          exam_id: string;
          id?: string;
          max_score?: number;
          skill: Database["public"]["Enums"]["exam_skill"];
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          exam_id?: string;
          id?: string;
          max_score?: number;
          skill?: Database["public"]["Enums"]["exam_skill"];
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_sections_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
        ];
      };
      exams: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_mock: boolean;
          level_id: string;
          max_attempts: number;
          pass_percentage: number;
          published_at: string | null;
          status: Database["public"]["Enums"]["exam_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_mock?: boolean;
          level_id: string;
          max_attempts?: number;
          pass_percentage?: number;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["exam_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_mock?: boolean;
          level_id?: string;
          max_attempts?: number;
          pass_percentage?: number;
          published_at?: string | null;
          status?: Database["public"]["Enums"]["exam_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exams_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exams_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_date: string | null;
          id: string;
          invoice_number: string;
          issued_at: string | null;
          notes: string | null;
          paid_at: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          id?: string;
          invoice_number: string;
          issued_at?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          id?: string;
          invoice_number?: string;
          issued_at?: string | null;
          notes?: string | null;
          paid_at?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_materials: {
        Row: {
          created_at: string;
          id: string;
          lesson_id: string;
          library_item_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          lesson_id: string;
          library_item_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          lesson_id?: string;
          library_item_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_materials_library_item_id_fkey";
            columns: ["library_item_id"];
            isOneToOne: false;
            referencedRelation: "library_items";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          lesson_id: string;
          progress_pct: number;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          lesson_id: string;
          progress_pct?: number;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          lesson_id?: string;
          progress_pct?: number;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          content_markdown: string | null;
          created_at: string;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          content_markdown?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          content_markdown?: string | null;
          created_at?: string;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      levels: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      library_items: {
        Row: {
          archived_at: string | null;
          category: Database["public"]["Enums"]["library_category"];
          course_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          file_size: number | null;
          id: string;
          language: string;
          level_code: string | null;
          mime_type: string | null;
          storage_bucket: string;
          storage_path: string;
          title: string;
          updated_at: string;
          visibility: Database["public"]["Enums"]["library_visibility"];
        };
        Insert: {
          archived_at?: string | null;
          category?: Database["public"]["Enums"]["library_category"];
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          file_size?: number | null;
          id?: string;
          language?: string;
          level_code?: string | null;
          mime_type?: string | null;
          storage_bucket?: string;
          storage_path: string;
          title: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["library_visibility"];
        };
        Update: {
          archived_at?: string | null;
          category?: Database["public"]["Enums"]["library_category"];
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          file_size?: number | null;
          id?: string;
          language?: string;
          level_code?: string | null;
          mime_type?: string | null;
          storage_bucket?: string;
          storage_path?: string;
          title?: string;
          updated_at?: string;
          visibility?: Database["public"]["Enums"]["library_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "library_items_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "library_items_level_code_fkey";
            columns: ["level_code"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["code"];
          },
        ];
      };
      live_sessions: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          meeting_provider: Database["public"]["Enums"]["meeting_provider"];
          meeting_room: string;
          meeting_url: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["live_session_status"];
          teacher_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          meeting_provider?: Database["public"]["Enums"]["meeting_provider"];
          meeting_room: string;
          meeting_url?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["live_session_status"];
          teacher_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          meeting_provider?: Database["public"]["Enums"]["meeting_provider"];
          meeting_room?: string;
          meeting_url?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["live_session_status"];
          teacher_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "live_sessions_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "live_sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          course_id: string;
          created_at: string;
          description: string | null;
          id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email_enabled: boolean;
          id: string;
          in_app_enabled: boolean;
          profile_id: string;
          updated_at: string;
          whatsapp_enabled: boolean;
        };
        Insert: {
          created_at?: string;
          email_enabled?: boolean;
          id?: string;
          in_app_enabled?: boolean;
          profile_id: string;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          email_enabled?: boolean;
          id?: string;
          in_app_enabled?: boolean;
          profile_id?: string;
          updated_at?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          category: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          link_id: string | null;
          link_page: string | null;
          message: string;
          metadata: Json;
          read_at: string | null;
          recipient_id: string;
          status: Database["public"]["Enums"]["notification_status"];
          title: string;
        };
        Insert: {
          category?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          link_id?: string | null;
          link_page?: string | null;
          message: string;
          metadata?: Json;
          read_at?: string | null;
          recipient_id: string;
          status?: Database["public"]["Enums"]["notification_status"];
          title: string;
        };
        Update: {
          category?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          link_id?: string | null;
          link_page?: string | null;
          message?: string;
          metadata?: Json;
          read_at?: string | null;
          recipient_id?: string;
          status?: Database["public"]["Enums"]["notification_status"];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          archived_at: string | null;
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          id: string;
          language: Database["public"]["Enums"]["app_locale"];
          last_name: string;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["profile_status"];
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          id: string;
          language?: Database["public"]["Enums"]["app_locale"];
          last_name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          id?: string;
          language?: Database["public"]["Enums"]["app_locale"];
          last_name?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["profile_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      student_payments: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_date: string | null;
          id: string;
          invoice_id: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_method: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          id?: string;
          invoice_id?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          due_date?: string | null;
          id?: string;
          invoice_id?: string | null;
          notes?: string | null;
          payment_date?: string | null;
          payment_method?: string | null;
          reference?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_subscriptions: {
        Row: {
          created_at: string;
          expires_at: string | null;
          grace_until: string | null;
          id: string;
          manually_extended: boolean;
          notes: string | null;
          starts_at: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          grace_until?: string | null;
          id?: string;
          manually_extended?: boolean;
          notes?: string | null;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          grace_until?: string | null;
          id?: string;
          manually_extended?: boolean;
          notes?: string | null;
          starts_at?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          level_code: string | null;
          notes: string | null;
          profile_id: string;
          status: Database["public"]["Enums"]["record_status"];
          student_code: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          level_code?: string | null;
          notes?: string | null;
          profile_id: string;
          status?: Database["public"]["Enums"]["record_status"];
          student_code?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          level_code?: string | null;
          notes?: string | null;
          profile_id?: string;
          status?: Database["public"]["Enums"]["record_status"];
          student_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_level_code_fkey";
            columns: ["level_code"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "students_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teachers: {
        Row: {
          archived_at: string | null;
          bio: string | null;
          created_at: string;
          employee_code: string | null;
          hourly_rate: number | null;
          id: string;
          profile_id: string;
          specialties: string[];
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          bio?: string | null;
          created_at?: string;
          employee_code?: string | null;
          hourly_rate?: number | null;
          id?: string;
          profile_id: string;
          specialties?: string[];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          bio?: string | null;
          created_at?: string;
          employee_code?: string | null;
          hourly_rate?: number | null;
          id?: string;
          profile_id?: string;
          specialties?: string[];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teachers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          module_id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          module_id: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          module_id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["content_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _test_as: { Args: { uid: string }; Returns: undefined };
      create_in_app_notification: {
        Args: {
          p_category?: string;
          p_link_id?: string;
          p_link_page?: string;
          p_message: string;
          p_metadata?: Json;
          p_recipient_id: string;
          p_title: string;
        };
        Returns: {
          category: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          link_id: string | null;
          link_page: string | null;
          message: string;
          metadata: Json;
          read_at: string | null;
          recipient_id: string;
          status: Database["public"]["Enums"]["notification_status"];
          title: string;
        };
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_profile_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      current_profile_status: {
        Args: never;
        Returns: Database["public"]["Enums"]["profile_status"];
      };
      current_student_id: { Args: never; Returns: string };
      current_teacher_id: { Args: never; Returns: string };
      ensure_student_subscription: {
        Args: { p_student_id: string };
        Returns: {
          created_at: string;
          expires_at: string | null;
          grace_until: string | null;
          id: string;
          manually_extended: boolean;
          notes: string | null;
          starts_at: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          student_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "student_subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      has_academic_access: { Args: { p_student_id: string }; Returns: boolean };
      has_active_academic_access: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      is_active_user: { Args: never; Returns: boolean };
      is_admin: { Args: never; Returns: boolean };
      is_enrolled_in_class: { Args: { p_class_id: string }; Returns: boolean };
      is_student: { Args: never; Returns: boolean };
      is_teacher: { Args: never; Returns: boolean };
      is_teacher_of_class: { Args: { p_class_id: string }; Returns: boolean };
      mark_student_payment_overdue: {
        Args: { p_payment_id: string };
        Returns: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_date: string | null;
          id: string;
          invoice_id: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_method: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "student_payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_student_payment_paid: {
        Args: { p_payment_id: string };
        Returns: {
          amount: number;
          created_at: string;
          created_by: string | null;
          currency: string;
          due_date: string | null;
          id: string;
          invoice_id: string | null;
          notes: string | null;
          payment_date: string | null;
          payment_method: string | null;
          reference: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "student_payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_exam_answer: {
        Args: {
          p_answer: Json;
          p_attempt_id: string;
          p_flagged?: boolean;
          p_question_id: string;
        };
        Returns: {
          answer: Json;
          attempt_id: string;
          created_at: string;
          flagged: boolean;
          id: string;
          is_correct: boolean | null;
          points_awarded: number | null;
          question_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "exam_answers";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      secure_promote_admin: { Args: { p_user_id: string }; Returns: undefined };
      start_exam_attempt: {
        Args: { p_exam_id: string };
        Returns: {
          created_at: string;
          exam_id: string;
          expires_at: string;
          id: string;
          max_score: number | null;
          percentage: number | null;
          score: number | null;
          skill_breakdown: Json;
          started_at: string;
          status: Database["public"]["Enums"]["exam_attempt_status"];
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "exam_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      student_can_access_exam: { Args: { p_exam_id: string }; Returns: boolean };
      student_level_sort_order: {
        Args: { p_student_id?: string };
        Returns: number;
      };
      submit_exam_attempt: {
        Args: { p_attempt_id: string };
        Returns: {
          created_at: string;
          exam_id: string;
          expires_at: string;
          id: string;
          max_score: number | null;
          percentage: number | null;
          score: number | null;
          skill_breakdown: Json;
          started_at: string;
          status: Database["public"]["Enums"]["exam_attempt_status"];
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "exam_attempts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      teacher_has_student: { Args: { p_student_id: string }; Returns: boolean };
      write_audit_log: {
        Args: {
          p_action: string;
          p_entity_id?: string;
          p_entity_type: string;
          p_metadata?: Json;
          p_new_data?: Json;
          p_old_data?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      app_locale: "en" | "fr" | "de";
      app_role: "admin" | "teacher" | "student";
      assignment_status: "draft" | "published" | "closed" | "archived";
      attendance_mark: "present" | "absent" | "late" | "excused";
      class_status: "planned" | "active" | "completed" | "archived";
      content_status: "draft" | "published" | "archived";
      enrollment_status: "active" | "completed" | "withdrawn" | "suspended";
      exam_attempt_status: "in_progress" | "submitted" | "graded" | "expired";
      exam_question_type:
        | "single_choice"
        | "multiple_choice"
        | "true_false"
        | "text"
        | "matching"
        | "ordering"
        | "listening"
        | "writing"
        | "speaking";
      exam_skill: "lesen" | "hoeren" | "schreiben" | "sprechen" | "grammatik" | "wortschatz";
      exam_status: "draft" | "published" | "archived";
      invoice_status: "draft" | "issued" | "paid" | "void" | "overdue";
      library_category:
        | "course_material"
        | "book"
        | "pdf"
        | "audio"
        | "video"
        | "administrative"
        | "employment"
        | "ausbildung"
        | "university"
        | "application"
        | "announcement";
      library_visibility: "private" | "staff" | "academy" | "published";
      live_session_status: "scheduled" | "live" | "completed" | "cancelled";
      meeting_provider: "jitsi" | "jaas" | "none";
      notification_channel: "in_app" | "email" | "whatsapp";
      notification_status: "unread" | "read" | "archived";
      payment_status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
      profile_status: "active" | "suspended" | "archived";
      record_status: "active" | "inactive" | "archived";
      submission_status: "draft" | "submitted" | "graded" | "returned";
      subscription_status:
        "active" | "grace_period" | "past_due" | "suspended" | "cancelled" | "manually_extended";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_locale: ["en", "fr", "de"],
      app_role: ["admin", "teacher", "student"],
      assignment_status: ["draft", "published", "closed", "archived"],
      attendance_mark: ["present", "absent", "late", "excused"],
      class_status: ["planned", "active", "completed", "archived"],
      content_status: ["draft", "published", "archived"],
      enrollment_status: ["active", "completed", "withdrawn", "suspended"],
      exam_attempt_status: ["in_progress", "submitted", "graded", "expired"],
      exam_question_type: [
        "single_choice",
        "multiple_choice",
        "true_false",
        "text",
        "matching",
        "ordering",
        "listening",
        "writing",
        "speaking",
      ],
      exam_skill: ["lesen", "hoeren", "schreiben", "sprechen", "grammatik", "wortschatz"],
      exam_status: ["draft", "published", "archived"],
      invoice_status: ["draft", "issued", "paid", "void", "overdue"],
      library_category: [
        "course_material",
        "book",
        "pdf",
        "audio",
        "video",
        "administrative",
        "employment",
        "ausbildung",
        "university",
        "application",
        "announcement",
      ],
      library_visibility: ["private", "staff", "academy", "published"],
      live_session_status: ["scheduled", "live", "completed", "cancelled"],
      meeting_provider: ["jitsi", "jaas", "none"],
      notification_channel: ["in_app", "email", "whatsapp"],
      notification_status: ["unread", "read", "archived"],
      payment_status: ["pending", "partial", "paid", "overdue", "cancelled"],
      profile_status: ["active", "suspended", "archived"],
      record_status: ["active", "inactive", "archived"],
      submission_status: ["draft", "submitted", "graded", "returned"],
      subscription_status: [
        "active",
        "grace_period",
        "past_due",
        "suspended",
        "cancelled",
        "manually_extended",
      ],
    },
  },
} as const;
