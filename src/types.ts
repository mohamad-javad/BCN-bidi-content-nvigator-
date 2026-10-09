import { HeadingCache } from 'obsidian';
import { UILanguage } from './i18n';

export type NavigatorDisplayMode = 'mini' | 'floating' | 'full-height';
export type BidiColorTheme = 'default' | 'nord' | 'dracula' | 'catppuccin' | 'gruvbox' | 'tokyo-night' | 'solarized';
export type BidiThemeStyle = 'solid' | 'transparent';

export interface BidiFlowSettings {
  uiLanguage: UILanguage;
  showFloatingWidget: boolean;
  defaultMode: NavigatorDisplayMode;
  floatingPosition: 'right' | 'left';
  indentStepPx: number;
  showProgressBar: boolean;
  showSearch: boolean;
  showLevelBadge: boolean;
  persianNumerals: boolean;
  maxHeadingLevel: number;
  widgetWidth: number;
  colorTheme: BidiColorTheme;
  themeStyle: BidiThemeStyle;
  rememberLastHeading: boolean;
  savedHeadingPositions: Record<string, SavedHeadingPosition>;
  showBottomToolbar: boolean;
  autoScrollSpeed: number;
  showAutoScrollBtn: boolean;
  showNextPartBtn: boolean;
  showPrevPartBtn: boolean;
  nextPartPageScroll: boolean;
  showNextSiblingBtn: boolean;
  showPrevSiblingBtn: boolean;
  deepHeadingJumpTarget: 'parent' | 'sibling';
}

export interface SavedHeadingPosition {
  headingText: string;
  line: number;
  level: number;
  timestamp: number;
}

export const DEFAULT_SETTINGS: BidiFlowSettings = {
  uiLanguage: 'en',
  showFloatingWidget: true,
  defaultMode: 'mini',
  floatingPosition: 'right',
  indentStepPx: 20,
  showProgressBar: true,
  showSearch: true,
  showLevelBadge: false,
  persianNumerals: false,
  maxHeadingLevel: 3,
  widgetWidth: 290,
  colorTheme: 'nord',
  themeStyle: 'transparent',
  rememberLastHeading: true,
  savedHeadingPositions: {},
  showBottomToolbar: true,
  autoScrollSpeed: 30,
  showAutoScrollBtn: true,
  showNextPartBtn: true,
  showPrevPartBtn: true,
  nextPartPageScroll: true,
  showNextSiblingBtn: true,
  showPrevSiblingBtn: true,
  deepHeadingJumpTarget: 'parent',
};

export interface BidiHeadingNode {
  id: string;
  heading: HeadingCache;
  level: number;
  text: string;
  line: number;
  parent: BidiHeadingNode | null;
  children: BidiHeadingNode[];
  isCollapsed: boolean;
  isVisible: boolean;
}

export interface SurroundingHeadings {
  prev: HeadingCache | null;
  active: HeadingCache | null;
  next: HeadingCache | null;
  activeIndex: number;
  totalCount: number;
}

export type SectionNavigationDirection = 'prev' | 'next';
