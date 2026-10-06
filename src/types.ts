import { HeadingCache } from 'obsidian';
import { UILanguage } from './i18n';

export type NavigatorDisplayMode = 'mini' | 'floating' | 'full-height';

export interface BidiFlowSettings {
  uiLanguage: UILanguage;
  showFloatingWidget: boolean;
  defaultMode: NavigatorDisplayMode;
  floatingPosition: 'right' | 'left';
  indentStepPx: number;
  showProgressBar: boolean;
  showSearch: boolean;
  showLevelBadge: boolean;
  accentGlow: boolean;
  persianNumerals: boolean;
  maxHeadingLevel: number;
  widgetWidth: number;
}

export const DEFAULT_SETTINGS: BidiFlowSettings = {
  uiLanguage: 'fa',
  showFloatingWidget: true,
  defaultMode: 'floating',
  floatingPosition: 'right',
  indentStepPx: 12,
  showProgressBar: true,
  showSearch: true,
  showLevelBadge: true,
  accentGlow: true,
  persianNumerals: true,
  maxHeadingLevel: 6,
  widgetWidth: 260,
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
