import type { WindowInfo } from '../types/index.js';

export interface CategoryPattern {
  // Match criteria (all specified criteria must match)
  appName?: string | RegExp;
  appBundleId?: string | RegExp;
  windowTitle?: string | RegExp;
  // Category to assign
  category: string;
  // Higher priority patterns are checked first
  priority?: number;
}

// Default patterns for auto-categorization
export const DEFAULT_PATTERNS: CategoryPattern[] = [
  // === IDEs and Code Editors (programming) ===
  {
    appBundleId: 'com.microsoft.VSCode',
    category: 'programming',
    priority: 10,
  },
  {
    appBundleId: 'com.apple.dt.Xcode',
    category: 'programming',
    priority: 10,
  },
  {
    appName: /^(IntelliJ IDEA|WebStorm|PyCharm|PhpStorm|RubyMine|GoLand|CLion|Rider|DataGrip)$/i,
    category: 'programming',
    priority: 10,
  },
  {
    appBundleId: 'com.sublimetext.4',
    category: 'programming',
    priority: 10,
  },
  {
    appBundleId: /^com\.sublimetext/,
    category: 'programming',
    priority: 10,
  },
  {
    appName: /Atom|Vim|Neovim|Emacs|Nova/i,
    category: 'programming',
    priority: 10,
  },
  {
    appBundleId: 'dev.zed.Zed',
    category: 'programming',
    priority: 10,
  },
  {
    appName: 'Cursor',
    category: 'programming',
    priority: 10,
  },

  // === Terminal with debugging hints ===
  {
    appName: /^(Terminal|iTerm|iTerm2|Warp|Hyper|Alacritty|kitty)$/i,
    windowTitle: /\b(gdb|lldb|debug|debugger|pdb|byebug|binding\.pry)\b/i,
    category: 'debugging',
    priority: 15,
  },
  {
    appName: /^(Terminal|iTerm|iTerm2|Warp|Hyper|Alacritty|kitty)$/i,
    windowTitle: /\b(git\s+(diff|log|blame|bisect))\b/i,
    category: 'debugging',
    priority: 15,
  },
  {
    appName: /^(Terminal|iTerm|iTerm2|Warp|Hyper|Alacritty|kitty)$/i,
    windowTitle: /\b(npm\s+test|jest|mocha|pytest|rspec)\b/i,
    category: 'testing',
    priority: 15,
  },
  {
    appName: /^(Terminal|iTerm|iTerm2|Warp|Hyper|Alacritty|kitty)$/i,
    category: 'programming',
    priority: 5,
  },

  // === Spreadsheets (excel-modeling) ===
  {
    appBundleId: 'com.microsoft.Excel',
    category: 'excel-modeling',
    priority: 10,
  },
  {
    appBundleId: 'com.apple.iWork.Numbers',
    category: 'excel-modeling',
    priority: 10,
  },
  {
    appName: /Google Sheets/i,
    category: 'excel-modeling',
    priority: 10,
  },
  // Browser with Google Sheets
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Google Sheets|spreadsheet/i,
    category: 'excel-modeling',
    priority: 12,
  },

  // === Presentations ===
  {
    appBundleId: 'com.microsoft.Powerpoint',
    category: 'presentations',
    priority: 10,
  },
  {
    appBundleId: 'com.apple.iWork.Keynote',
    category: 'presentations',
    priority: 10,
  },
  {
    appName: /Google Slides/i,
    category: 'presentations',
    priority: 10,
  },
  // Browser with Google Slides
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Google Slides|presentation/i,
    category: 'presentations',
    priority: 12,
  },

  // === Code Review ===
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /GitHub.*Pull Request|GitLab.*Merge Request|Bitbucket.*Pull Request/i,
    category: 'code-review',
    priority: 15,
  },
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Review.*changes|Reviewing|Code Review/i,
    category: 'code-review',
    priority: 12,
  },

  // === Research ===
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Stack Overflow|MDN Web Docs|documentation|docs\.|readme/i,
    category: 'research',
    priority: 12,
  },
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Wikipedia|Medium|Dev\.to|Hacker News/i,
    category: 'research',
    priority: 10,
  },

  // === Financial Analysis ===
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Bloomberg|Reuters|Yahoo Finance|MarketWatch|SEC\.gov|EDGAR/i,
    category: 'financial-analysis',
    priority: 12,
  },
  {
    appBundleId: 'com.bloomberg.terminal',
    category: 'financial-analysis',
    priority: 10,
  },

  // === Communication ===
  {
    appBundleId: 'com.tinyspeck.slackmacgap',
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^Slack$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appBundleId: 'com.microsoft.teams',
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^(Microsoft Teams|Teams)$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^Discord$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appBundleId: 'com.apple.MobileSMS',
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^Messages$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^WhatsApp$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^Telegram$/i,
    category: 'communication',
    priority: 10,
  },

  // === Email ===
  {
    appBundleId: 'com.apple.mail',
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^(Mail|Outlook|Spark|Airmail|Superhuman)$/i,
    category: 'communication',
    priority: 10,
  },
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Gmail|Outlook.*Mail|Yahoo Mail/i,
    category: 'communication',
    priority: 12,
  },

  // === Meetings ===
  {
    appBundleId: 'us.zoom.xos',
    category: 'meetings',
    priority: 10,
  },
  {
    appName: /^zoom\.us$/i,
    category: 'meetings',
    priority: 10,
  },
  {
    appName: /^(Google Meet|Webex|GoToMeeting|Skype)$/i,
    category: 'meetings',
    priority: 10,
  },
  {
    appName: /^(Google Chrome|Safari|Firefox|Arc|Brave|Microsoft Edge)$/i,
    windowTitle: /Google Meet|meet\.google\.com|Zoom Meeting/i,
    category: 'meetings',
    priority: 12,
  },
  {
    appBundleId: 'com.apple.iCal',
    category: 'meetings',
    priority: 8,
  },
  {
    appName: /^Calendar$/i,
    category: 'meetings',
    priority: 8,
  },

  // === Design (optional category) ===
  {
    appName: /^(Figma|Sketch|Adobe XD|Photoshop|Illustrator)$/i,
    category: 'programming', // Falls back to programming for now
    priority: 8,
  },

  // === Note-taking (research) ===
  {
    appName: /^(Notion|Obsidian|Bear|Evernote|Apple Notes|Notes)$/i,
    category: 'research',
    priority: 8,
  },
];

// Sort patterns by priority (higher first)
export const SORTED_PATTERNS = [...DEFAULT_PATTERNS].sort(
  (a, b) => (b.priority || 0) - (a.priority || 0)
);
