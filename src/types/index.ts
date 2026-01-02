// Time entry stored in database
export interface TimeEntry {
  id: number;
  category_id: number | null;
  project_id: number | null;
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
  pollInterval: number;        // seconds between detection checks
  idleThreshold: number;       // seconds before considered idle
  minEntryDuration: number;    // minimum entry duration in seconds
  defaultCategory: string | null; // default category for uncategorized entries
}

// Goal periods
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

// Goal definition
export interface Goal {
  id: number;
  category_id: number;
  target_seconds: number;
  period: GoalPeriod;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Goal with progress information
export interface GoalWithProgress extends Goal {
  category_name: string;
  category_color: string | null;
  current_seconds: number;
  percentage: number;
}

// Project definition
export interface Project {
  id: number;
  name: string;
  client: string | null;
  color: string | null;
  description: string | null;
  hourly_rate: number | null;
  is_billable: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Project with time summary
export interface ProjectWithStats extends Project {
  total_seconds: number;
  entry_count: number;
}

// Tag definition
export interface Tag {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

// Tag with usage count
export interface TagWithCount extends Tag {
  usage_count: number;
}

// Entry-tag association
export interface EntryTag {
  entry_id: number;
  tag_id: number;
  created_at: string;
}
