// Time entry stored in database
export interface TimeEntry {
  id: number;
  category_id: number | null;
  app_name: string | null;
  app_bundle_id: string | null;
  window_title: string | null;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  is_manual: boolean;
  notes: string | null;
  created_at: string;
}

// Category definition
export interface Category {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  is_productive: boolean;
  created_at: string;
  updated_at: string;
}

// Categorization rule
export interface CategorizationRule {
  id: number;
  app_name_pattern: string | null;
  app_bundle_id: string | null;
  window_title_pattern: string | null;
  category_id: number;
  priority: number;
  created_at: string;
}

// Window info from detection
export interface WindowInfo {
  appName: string;
  appBundleId: string;
  windowTitle: string;
  timestamp: Date;
}

// Active session (current timer)
export interface ActiveSession {
  id: number;
  category_id: number | null;
  category_name: string | null;
  app_name: string | null;
  window_title: string | null;
  start_time: string;
  is_manual: boolean;
}

// Summary for reports
export interface CategorySummary {
  category: string;
  color: string | null;
  total_seconds: number;
  entry_count: number;
}

// Daily summary
export interface DailySummary {
  date: string;
  total_seconds: number;
  categories: CategorySummary[];
}

// Config settings
export interface Config {
  pollInterval: number;      // seconds between detection checks
  idleThreshold: number;     // seconds before considered idle
  minEntryDuration: number;  // minimum entry duration in seconds
}
