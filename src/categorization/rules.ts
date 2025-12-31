import type { WindowInfo } from '../types/index.js';
import { SORTED_PATTERNS, type CategoryPattern } from './patterns.js';
import { getDatabase } from '../storage/database.js';
import { getCategoryByName } from '../storage/repositories/categories.js';

// Check if a value matches a pattern (string or RegExp)
function matchesPattern(value: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return value.toLowerCase() === pattern.toLowerCase();
  }
  return pattern.test(value);
}

// Check if window info matches a category pattern
function matchesCategoryPattern(
  info: WindowInfo,
  pattern: CategoryPattern
): boolean {
  // Check app name
  if (pattern.appName !== undefined) {
    if (!matchesPattern(info.appName, pattern.appName)) {
      return false;
    }
  }

  // Check bundle ID
  if (pattern.appBundleId !== undefined) {
    if (!matchesPattern(info.appBundleId, pattern.appBundleId)) {
      return false;
    }
  }

  // Check window title
  if (pattern.windowTitle !== undefined) {
    if (!matchesPattern(info.windowTitle, pattern.windowTitle)) {
      return false;
    }
  }

  return true;
}

// Get user-defined rules from database
interface UserRule {
  id: number;
  app_name_pattern: string | null;
  app_bundle_id: string | null;
  window_title_pattern: string | null;
  category_id: number;
  priority: number;
  category_name: string;
}

function getUserRules(): UserRule[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT r.*, c.name as category_name
    FROM categorization_rules r
    JOIN categories c ON r.category_id = c.id
    ORDER BY r.priority DESC
  `).all() as UserRule[];
}

// Convert user rule to category pattern
function ruleToPattern(rule: UserRule): CategoryPattern & { category: string } {
  const pattern: CategoryPattern = {
    category: rule.category_name,
    priority: rule.priority + 100, // User rules get higher priority
  };

  if (rule.app_name_pattern) {
    // If it looks like a regex (contains special chars), treat as regex
    if (/[.*+?^${}()|[\]\\]/.test(rule.app_name_pattern)) {
      pattern.appName = new RegExp(rule.app_name_pattern, 'i');
    } else {
      pattern.appName = rule.app_name_pattern;
    }
  }

  if (rule.app_bundle_id) {
    pattern.appBundleId = rule.app_bundle_id;
  }

  if (rule.window_title_pattern) {
    if (/[.*+?^${}()|[\]\\]/.test(rule.window_title_pattern)) {
      pattern.windowTitle = new RegExp(rule.window_title_pattern, 'i');
    } else {
      pattern.windowTitle = new RegExp(rule.window_title_pattern, 'i');
    }
  }

  return pattern;
}

// Main categorization function
export function categorize(info: WindowInfo): string | null {
  // First check user-defined rules
  const userRules = getUserRules();
  for (const rule of userRules) {
    const pattern = ruleToPattern(rule);
    if (matchesCategoryPattern(info, pattern)) {
      return pattern.category;
    }
  }

  // Then check default patterns
  for (const pattern of SORTED_PATTERNS) {
    if (matchesCategoryPattern(info, pattern)) {
      // Verify category exists
      const category = getCategoryByName(pattern.category);
      if (category) {
        return pattern.category;
      }
    }
  }

  return null; // Uncategorized
}

// Get category ID from name (helper for entries)
export function getCategoryIdByName(name: string): number | null {
  const category = getCategoryByName(name);
  return category?.id ?? null;
}

// Add a new user rule
export function addRule(options: {
  appNamePattern?: string;
  appBundleId?: string;
  windowTitlePattern?: string;
  categoryName: string;
  priority?: number;
}): boolean {
  const category = getCategoryByName(options.categoryName);
  if (!category) {
    throw new Error(`Category not found: ${options.categoryName}`);
  }

  const db = getDatabase();
  db.prepare(`
    INSERT INTO categorization_rules
    (app_name_pattern, app_bundle_id, window_title_pattern, category_id, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    options.appNamePattern || null,
    options.appBundleId || null,
    options.windowTitlePattern || null,
    category.id,
    options.priority || 0
  );

  return true;
}

// Remove a rule by ID
export function removeRule(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM categorization_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

// List all user rules
export function listRules(): UserRule[] {
  return getUserRules();
}
