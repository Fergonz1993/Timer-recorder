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
  // Auto-pause fields
  paused_at: string | null;
  paused_duration_seconds: number | null;
  auto_paused: boolean;
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
  // Auto-pause fields
  paused_at: string | null;
  paused_duration_seconds: number | null;
  auto_paused: boolean;
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
  'pomodoro.work': number;     // pomodoro work duration in minutes
  'pomodoro.break': number;    // pomodoro break duration in minutes
  'pomodoro.longBreak': number; // pomodoro long break duration in minutes
  'pomodoro.sessionsBeforeLongBreak': number; // sessions before long break
  // Auto-pause settings
  autoPauseEnabled?: boolean;   // enable auto-pause detection
  // Privacy settings (dynamic, not in CONFIG_KEYS for validation)
  privacy_lockdown?: boolean;           // disable all network features
  webhooks_enabled?: boolean;           // enable/disable webhooks globally
  dashboard_enabled?: boolean;          // enable/disable dashboard
  anonymous_mode?: boolean;             // don't store app/window names
  data_retention_enabled?: boolean;     // auto-delete old data
  data_retention_days?: number | null;  // days to keep data
  database_encryption?: boolean;        // encryption status marker
  [key: string]: unknown;               // allow dynamic keys for privacy
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
