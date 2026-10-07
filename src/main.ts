import { Plugin, MarkdownView, WorkspaceLeaf, setTooltip, TFile, HeadingCache } from 'obsidian';
import { BidiFlowSettings, DEFAULT_SETTINGS, SavedHeadingPosition } from './types';
import { BidiFlowSidebarView, BIDI_FLOW_VIEW_TYPE } from './BidiFlowSidebarView';
import { BidiFlowFloatingWidget } from './BidiFlowFloatingWidget';
import { BidiFlowSettingTab } from './settings';
import { scrollToHeading } from './scrollSpy';
import { cleanHeadingText } from './utils';
import { t } from './i18n';

export default class BidiFlowNavigatorPlugin extends Plugin {
  public settings: BidiFlowSettings = DEFAULT_SETTINGS;
  private floatingWidgets: Map<MarkdownView, BidiFlowFloatingWidget> = new Map();
  private ribbonIconEl: HTMLElement | null = null;
  private restoredFilesForViews: WeakMap<MarkdownView, string> = new WeakMap();
  private restoringFiles: Set<string> = new Set();
  private debouncedSaveSettingsTimer: number | null = null;

  async onload() {
    await this.loadSettings();

    const tr = t(this.settings.uiLanguage);

    // 1. Register Sidebar View
    this.registerView(
      BIDI_FLOW_VIEW_TYPE,
      (leaf: WorkspaceLeaf) =>
        new BidiFlowSidebarView(leaf, this.settings, (heading) => {
          const activeMd = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeMd?.file) {
            this.saveHeadingPosition(activeMd.file.path, heading);
          }
        })
    );

    // 2. Add Ribbon Icon with Toggle behavior
    this.ribbonIconEl = this.addRibbonIcon('compass', tr.viewTitle, () => {
      void this.toggleSidebarView();
    });
    setTooltip(this.ribbonIconEl, tr.viewTitle);

    // 3. Register Commands
    this.addCommand({
      id: 'open-bidi-navigator-sidebar',
      name: tr.cmdOpenSidebar,
      callback: () => {
        void this.toggleSidebarView();
      },
    });

    this.addCommand({
      id: 'jump-to-next-section',
      name: tr.cmdNextSection,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpSection('next');
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'jump-to-prev-section',
      name: tr.cmdPrevSection,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpSection('prev');
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'toggle-floating-navigator',
      name: tr.cmdToggleFloating,
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          const widget = this.floatingWidgets.get(view);
          if (widget) {
            widget.toggleMini();
          }
        }
      },
    });

    this.addCommand({
      id: 'cycle-floating-mode',
      name: tr.cmdCycleMode,
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          const widget = this.floatingWidgets.get(view);
          if (widget) {
            widget.cycleMode();
          }
        }
      },
    });

    // 4. Register Settings Tab
    this.addSettingTab(new BidiFlowSettingTab(this.app, this));

    // 5. Manage Floating Widgets on Workspace Events
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.syncFloatingWidgets();
      })
    );

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.syncFloatingWidgets();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        for (const [view, widget] of this.floatingWidgets.entries()) {
          if (view.file?.path === file.path) {
            widget.refresh();
          }
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file) {
          const view = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (view && view.file?.path === file.path) {
            void this.restoreHeadingForView(view, file);
          }
        }
      })
    );

    // Initial mount on workspace ready
    this.app.workspace.onLayoutReady(() => {
      this.syncFloatingWidgets();
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        void this.restoreHeadingForView(activeView, activeView.file);
      }
    });
  }

  public syncFloatingWidgets(): void {
    if (!this.settings.showFloatingWidget) {
      this.destroyAllFloatingWidgets();
      return;
    }

    // Clean up closed views
    for (const [view, widget] of this.floatingWidgets.entries()) {
      if (!view.containerEl.isConnected) {
        widget.unload();
        this.floatingWidgets.delete(view);
      }
    }

    // Mount on all active markdown leaves
    const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of markdownLeaves) {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        if (!this.floatingWidgets.has(view)) {
          const widget = new BidiFlowFloatingWidget(view, this.settings, (heading) => {
            if (view.file) {
              this.saveHeadingPosition(view.file.path, heading);
            }
          });
          view.addChild(widget);
          this.floatingWidgets.set(view, widget);
        } else {
          this.floatingWidgets.get(view)?.refresh();
        }

        if (view.file) {
          void this.restoreHeadingForView(view, view.file);
        }
      }
    }
  }

  public destroyAllFloatingWidgets(): void {
    for (const widget of this.floatingWidgets.values()) {
      widget.unload();
    }
    this.floatingWidgets.clear();
  }

  public refreshAllWidgets(): void {
    if (!this.settings.showFloatingWidget) {
      this.destroyAllFloatingWidgets();
    } else {
      for (const widget of this.floatingWidgets.values()) {
        widget.updateSettings(this.settings);
      }
      this.syncFloatingWidgets();
    }

    // Update sidebar views
    const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
    for (const leaf of sidebarLeaves) {
      if (leaf.view instanceof BidiFlowSidebarView) {
        leaf.view.updateSettings(this.settings);
      }
    }

    // Update ribbon tooltip & aria-label
    if (this.ribbonIconEl) {
      const tr = t(this.settings.uiLanguage);
      this.ribbonIconEl.setAttribute('aria-label', tr.viewTitle);
      setTooltip(this.ribbonIconEl, tr.viewTitle);
    }
  }

  public async toggleSidebarView(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
    const rightSplit = workspace.rightSplit;

    if (leaves.length > 0) {
      const leaf = leaves[0];
      const isRightOpen = !rightSplit?.collapsed;
      const isOurTabVisible = leaf.view.containerEl.isShown();

      if (isRightOpen && isOurTabVisible) {
        // Toggle closed: collapse right sidebar
        rightSplit?.collapse();
        return;
      }

      // Expand sidebar and reveal our tab
      if (rightSplit?.collapsed) {
        rightSplit.expand();
      }
      await workspace.revealLeaf(leaf);
      return;
    }

    await this.activateSidebarView();
  }

  public async activateSidebarView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        await rightLeaf.setViewState({ type: BIDI_FLOW_VIEW_TYPE, active: true });
        leaf = rightLeaf;
      }
    }
    if (leaf) {
      if (workspace.rightSplit?.collapsed) {
        workspace.rightSplit.expand();
      }
      await workspace.revealLeaf(leaf);
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<BidiFlowSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public saveHeadingPosition(filePath: string, heading: HeadingCache): void {
    if (!this.settings.rememberLastHeading) return;
    if (this.restoringFiles.has(filePath)) return;

    if (!this.settings.savedHeadingPositions) {
      this.settings.savedHeadingPositions = {};
    }

    const currentSaved = this.settings.savedHeadingPositions[filePath];
    if (
      currentSaved &&
      currentSaved.headingText === heading.heading &&
      currentSaved.line === heading.position.start.line
    ) {
      return;
    }

    this.settings.savedHeadingPositions[filePath] = {
      headingText: heading.heading,
      line: heading.position.start.line,
      level: heading.level,
      timestamp: Date.now(),
    };

    this.triggerDebouncedSaveSettings();
  }

  private triggerDebouncedSaveSettings(): void {
    if (this.debouncedSaveSettingsTimer !== null) {
      window.clearTimeout(this.debouncedSaveSettingsTimer);
    }
    this.debouncedSaveSettingsTimer = window.setTimeout(() => {
      this.debouncedSaveSettingsTimer = null;
      this.pruneSavedHeadings();
      void this.saveSettings();
    }, 1000);
  }

  private pruneSavedHeadings(): void {
    if (!this.settings.savedHeadingPositions) return;
    const entries = Object.entries(this.settings.savedHeadingPositions);
    const maxEntries = 300;
    if (entries.length > maxEntries) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      this.settings.savedHeadingPositions = Object.fromEntries(entries.slice(0, maxEntries));
    }
  }

  private findMatchingHeading(
    headings: HeadingCache[],
    saved: SavedHeadingPosition
  ): HeadingCache | null {
    if (!headings || headings.length === 0) return null;

    // 1. Exact match on heading text and line
    const exact = headings.find(
      h => h.heading === saved.headingText && h.position.start.line === saved.line
    );
    if (exact) return exact;

    // 2. Exact match on heading text (closest to saved.line)
    const textMatches = headings.filter(h => h.heading === saved.headingText);
    if (textMatches.length === 1) {
      return textMatches[0];
    }
    if (textMatches.length > 1) {
      return textMatches.reduce((prev, curr) =>
        Math.abs(curr.position.start.line - saved.line) < Math.abs(prev.position.start.line - saved.line)
          ? curr
          : prev
      );
    }

    // 3. Cleaned text match (ignoring whitespace and markdown symbols)
    const cleanSaved = cleanHeadingText(saved.headingText);
    const cleanMatches = headings.filter(h => cleanHeadingText(h.heading) === cleanSaved);
    if (cleanMatches.length > 0) {
      return cleanMatches.reduce((prev, curr) =>
        Math.abs(curr.position.start.line - saved.line) < Math.abs(prev.position.start.line - saved.line)
          ? curr
          : prev
      );
    }

    // 4. Line proximity match (if title was slightly renamed)
    const lineMatches = headings.filter(h => Math.abs(h.position.start.line - saved.line) <= 3);
    if (lineMatches.length > 0) {
      return lineMatches.reduce((prev, curr) =>
        Math.abs(curr.position.start.line - saved.line) < Math.abs(prev.position.start.line - saved.line)
          ? curr
          : prev
      );
    }

    return null;
  }

  public async restoreHeadingForView(view: MarkdownView, file: TFile): Promise<void> {
    if (!this.settings.rememberLastHeading) return;
    if (this.restoredFilesForViews.get(view) === file.path) return;

    const saved = this.settings.savedHeadingPositions?.[file.path];
    if (!saved) {
      this.restoredFilesForViews.set(view, file.path);
      return;
    }

    this.restoredFilesForViews.set(view, file.path);
    this.restoringFiles.add(file.path);

    const tryRestore = (): boolean => {
      if (!view.containerEl.isConnected || view.file?.path !== file.path) {
        this.restoringFiles.delete(file.path);
        return true;
      }

      const cache = this.app.metadataCache.getFileCache(file);
      const headings = cache?.headings;
      if (!headings || headings.length === 0) {
        return false;
      }

      const targetHeading = this.findMatchingHeading(headings, saved);
      if (targetHeading) {
        window.setTimeout(() => {
          if (!view.containerEl.isConnected || view.file?.path !== file.path) {
            this.restoringFiles.delete(file.path);
            return;
          }

          scrollToHeading(view, targetHeading, 'smooth');

          const widget = this.floatingWidgets.get(view);
          if (widget?.core) {
            widget.core.setActiveHeadingManually(targetHeading);
          }

          const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
          for (const leaf of sidebarLeaves) {
            if (leaf.view instanceof BidiFlowSidebarView && leaf.view.core) {
              leaf.view.core.setActiveHeadingManually(targetHeading);
            }
          }

          window.setTimeout(() => {
            this.restoringFiles.delete(file.path);
          }, 450);
        }, 120);
      } else {
        this.restoringFiles.delete(file.path);
      }
      return true;
    };

    if (tryRestore()) {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts++;
      if (tryRestore() || attempts > 10) {
        window.clearInterval(interval);
        this.restoringFiles.delete(file.path);
      }
    }, 150);
  }

  onunload() {
    if (this.debouncedSaveSettingsTimer !== null) {
      window.clearTimeout(this.debouncedSaveSettingsTimer);
      this.debouncedSaveSettingsTimer = null;
    }
    this.pruneSavedHeadings();
    void this.saveSettings();
    this.destroyAllFloatingWidgets();
  }
}
