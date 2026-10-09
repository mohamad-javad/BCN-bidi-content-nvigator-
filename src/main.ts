import { Plugin, MarkdownView, WorkspaceLeaf, setTooltip, TFile, HeadingCache } from 'obsidian';
import { BidiFlowSettings, DEFAULT_SETTINGS, SavedHeadingPosition } from './types';
import { BidiFlowSidebarView, BIDI_FLOW_VIEW_TYPE } from './BidiFlowSidebarView';
import { BidiFlowNavigatorCore } from './BidiFlowNavigatorCore';
import { BidiFlowFloatingWidget } from './BidiFlowFloatingWidget';
import { BidiFlowSettingTab } from './settings';
import { scrollToHeading, scrollWithRetry } from './scrollSpy';
import { cleanHeadingText } from './utils';
import { t } from './i18n';

export default class BidiFlowNavigatorPlugin extends Plugin {
  public settings: BidiFlowSettings = DEFAULT_SETTINGS;
  private floatingWidgets: Map<MarkdownView, BidiFlowFloatingWidget> = new Map();
  private ribbonIconEl: HTMLElement | null = null;
  private restoredFilesForViews: WeakMap<MarkdownView, string> = new WeakMap();
  private restoringFiles: Set<string> = new Set();
  private debouncedSaveSettingsTimer: number | null = null;
  private viewModeMap: WeakMap<MarkdownView, string> = new WeakMap();
  private lastActiveHeadings: WeakMap<MarkdownView, HeadingCache> = new WeakMap();
  /** Tracks all pending restore intervals so they can be cleared on plugin unload. */
  private restoreIntervals: Set<number> = new Set();

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
            if (this.restoringFiles.has(activeMd.file.path)) return;
            this.lastActiveHeadings.set(activeMd, heading);
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

    this.addCommand({
      id: 'toggle-auto-scroll',
      name: tr.cmdToggleAutoScroll,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            if (BidiFlowNavigatorCore.isAnyAutoScrolling()) {
              BidiFlowNavigatorCore.stopAllAutoScroll();
            } else {
              const widget = this.floatingWidgets.get(view);
              if (widget?.core) {
                widget.core.startAutoScroll();
              } else {
                const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
                for (const sl of sidebarLeaves) {
                  if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                    sl.view.core.startAutoScroll();
                    break;
                  }
                }
              }
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'jump-to-next-part',
      name: tr.cmdNextPart,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpNextPart();
            } else {
              const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
              for (const sl of sidebarLeaves) {
                if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                  sl.view.core.jumpNextPart();
                  break;
                }
              }
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'jump-to-next-sibling',
      name: tr.cmdNextSibling,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpNextSibling();
            } else {
              const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
              for (const sl of sidebarLeaves) {
                if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                  sl.view.core.jumpNextSibling();
                  break;
                }
              }
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'jump-to-prev-part',
      name: tr.cmdPrevPart,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpPrevPart();
            } else {
              const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
              for (const sl of sidebarLeaves) {
                if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                  sl.view.core.jumpPrevPart();
                  break;
                }
              }
            }
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: 'jump-to-prev-sibling',
      name: tr.cmdPrevSibling,
      checkCallback: (checking: boolean) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          if (!checking) {
            const widget = this.floatingWidgets.get(view);
            if (widget?.core) {
              widget.core.jumpPrevSibling();
            } else {
              const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
              for (const sl of sidebarLeaves) {
                if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                  sl.view.core.jumpPrevSibling();
                  break;
                }
              }
            }
          }
          return true;
        }
        return false;
      },
    });

    // 4. Register Settings Tab
    this.addSettingTab(new BidiFlowSettingTab(this.app, this));

    // 5. Manage Floating Widgets on Workspace Events
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.syncFloatingWidgets();
        this.handleModeSwitchForViews();
      })
    );

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.syncFloatingWidgets();
        this.handleModeSwitchForViews();
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
      this.app.metadataCache.on('resolved', () => {
        for (const widget of this.floatingWidgets.values()) {
          widget.refresh();
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        this.flushSaveSettings();
        if (file) {
          this.syncFloatingWidgets();
          // Allow Obsidian event loop to finish mounting and binding leaf view
          window.setTimeout(() => {
            const leaves = this.app.workspace.getLeavesOfType('markdown');
            const targetLeaf = leaves.find(l => (l.view as MarkdownView)?.file?.path === file.path);
            const view = (targetLeaf?.view as MarkdownView) ?? this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view && view.file?.path === file.path) {
              void this.restoreHeadingForView(view, file, true);
            }
          }, 35);
        }
      })
    );

    this.registerEvent(
      this.app.workspace.on('quit', () => {
        this.flushSaveSettings();
      })
    );

    // Initial mount on workspace ready
    this.app.workspace.onLayoutReady(() => {
      this.syncFloatingWidgets();
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView?.file) {
        void this.restoreHeadingForView(activeView, activeView.file, true);
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
          // Lock from saving line 0 during initial view creation
          if (view.file && this.restoredFilesForViews.get(view) !== view.file.path) {
            this.restoringFiles.add(view.file.path);
          }

          const widget = new BidiFlowFloatingWidget(view, this.settings, (heading) => {
            if (view.file) {
              if (this.restoringFiles.has(view.file.path)) return;
              this.lastActiveHeadings.set(view, heading);
              this.saveHeadingPosition(view.file.path, heading);
            }
          });
          view.addChild(widget);
          this.floatingWidgets.set(view, widget);
        } else {
          this.floatingWidgets.get(view)?.refresh();
        }
      }
    }
  }

  private handleModeSwitchForViews(): void {
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    for (const leaf of leaves) {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        const file = view.file;
        if (!file) continue;

        const currentMode = view.getMode();
        const prevMode = this.viewModeMap.get(view);

        if (prevMode && prevMode !== currentMode) {
          this.viewModeMap.set(view, currentMode);
          const filePath = file.path;

          // Lock position saving immediately so transient 0-scroll events during mode switch don't overwrite the heading!
          this.restoringFiles.add(filePath);

          // Obsidian natively maintains the reader/editor position during mode switch.
          // We do NOT force a synthetic scroll here to avoid backwards-drift loops or jump-to-top.
          // Once the view settles in the new mode, read the current heading and synchronize the navigator UI smoothly.
          window.setTimeout(() => {
            if (!view.containerEl.isConnected || view.file?.path !== filePath) {
              this.restoringFiles.delete(filePath);
              return;
            }

            const cache = this.app.metadataCache.getFileCache(file);
            const headings = cache?.headings;
            if (headings && headings.length > 0) {
              const active = getActiveHeading(view, headings, 100) ?? this.lastActiveHeadings.get(view);
              if (active) {
                this.lastActiveHeadings.set(view, active);
                this.saveHeadingPosition(filePath, active);

                const widget = this.floatingWidgets.get(view);
                if (widget?.core) {
                  widget.core.setActiveHeadingManually(active);
                }
                const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
                for (const sl of sidebarLeaves) {
                  if (sl.view instanceof BidiFlowSidebarView && sl.view.core) {
                    if (sl.view.core.getHeadingCount() === 0) {
                      sl.view.core.setView(view);
                    }
                    sl.view.core.setActiveHeadingManually(active);
                  }
                }
              }
            }

            this.restoringFiles.delete(filePath);
          }, 200);
        } else if (!prevMode) {
          this.viewModeMap.set(view, currentMode);
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
    }, 250);
  }

  public flushSaveSettings(): void {
    if (this.debouncedSaveSettingsTimer !== null) {
      window.clearTimeout(this.debouncedSaveSettingsTimer);
      this.debouncedSaveSettingsTimer = null;
    }
    this.pruneSavedHeadings();
    void this.saveSettings();
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

  public async restoreHeadingForView(
    view: MarkdownView,
    file: TFile,
    force = false
  ): Promise<void> {
    if (!this.settings.rememberLastHeading) return;
    if (!force && this.restoredFilesForViews.get(view) === file.path) return;

    const saved = this.settings.savedHeadingPositions?.[file.path];
    if (!saved) {
      this.restoredFilesForViews.set(view, file.path);
      this.restoringFiles.delete(file.path);
      return;
    }

    this.restoredFilesForViews.set(view, file.path);
    this.restoringFiles.add(file.path);

    const tryRestore = (): boolean => {
      if (!view.containerEl.isConnected || view.file?.path !== file.path) {
        this.restoringFiles.delete(file.path);
        return true;
      }

      const targetLine = saved.line;

      // 1. Instant line & cursor scroll (Fast Path)
      if (view.getMode() === 'preview') {
        const preview = view.previewMode;
        if (preview) {
          try {
            const previewRenderer = (preview as unknown as { renderer?: { applyScrollDelayed?: (line: number) => void; applyScroll?: (line: number) => boolean } })?.renderer;
            if (typeof previewRenderer?.applyScrollDelayed === 'function') {
              previewRenderer.applyScrollDelayed(targetLine);
            } else if (typeof (preview as unknown as { applyScroll?: (line: number) => void })?.applyScroll === 'function') {
              (preview as unknown as { applyScroll?: (line: number) => void }).applyScroll!(targetLine);
            }
          } catch {
            // Ignore
          }
        }
      } else {
        const editor = view.editor;
        if (editor) {
          const totalLines = editor.lineCount();
          if (totalLines <= targetLine && totalLines < 5) {
            // Editor content is still loading from disk asynchronously
            return false;
          }

          const safeLine = Math.min(targetLine, Math.max(0, totalLines - 1));
          try {
            editor.setCursor({ line: safeLine, ch: 0 });
          } catch {
            // Ignore
          }

          const scroller = view.contentEl.querySelector<HTMLElement>('.cm-scroller');
          if (scroller) {
            const cm = getCodeMirrorView(editor);
            if (cm?.state?.doc) {
              try {
                const line1 = Math.min(cm.state.doc.lines, Math.max(1, safeLine + 1));
                const linePos = cm.state.doc.line(line1).from;
                const block = cm.lineBlockAt ? cm.lineBlockAt(linePos) : null;
                if (block) {
                  scroller.scrollTo({ top: block.top, behavior: 'auto' });
                }
              } catch {
                // Ignore
              }
            }
          }

          try {
            editor.scrollIntoView({ from: { line: safeLine, ch: 0 }, to: { line: safeLine, ch: 0 } }, false);
          } catch {
            // Ignore
          }
        }
      }

      // 2. Metadata sync: Find matching heading for outline highlight
      const cache = this.app.metadataCache.getFileCache(file);
      const headings = cache?.headings;
      if (headings && headings.length > 0) {
        const targetHeading = this.findMatchingHeading(headings, saved)
          ?? headings.find(h => h.position.start.line === targetLine)
          ?? headings[0];

        if (targetHeading) {
          this.lastActiveHeadings.set(view, targetHeading);

          const widget = this.floatingWidgets.get(view);
          if (widget?.core) {
            widget.core.setActiveHeadingManually(targetHeading);
          }

          const sidebarLeaves = this.app.workspace.getLeavesOfType(BIDI_FLOW_VIEW_TYPE);
          for (const leaf of sidebarLeaves) {
            if (leaf.view instanceof BidiFlowSidebarView && leaf.view.core) {
              if (leaf.view.core.getHeadingCount() === 0) {
                leaf.view.core.setView(view);
              }
              leaf.view.core.setActiveHeadingManually(targetHeading);
            }
          }
        }
      }

      window.setTimeout(() => {
        this.restoringFiles.delete(file.path);
      }, 150);

      return true;
    };

    if (tryRestore()) {
      return;
    }

    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts++;
      if (tryRestore() || attempts >= 25) {
        window.clearInterval(interval);
        this.restoreIntervals.delete(interval);
        if (attempts >= 25) {
          this.restoringFiles.delete(file.path);
        }
      }
    }, 40);
    this.restoreIntervals.add(interval);
  }

  onunload() {
    this.flushSaveSettings();
    this.destroyAllFloatingWidgets();
    // Clear any pending restore intervals to prevent post-unload callbacks
    for (const id of this.restoreIntervals) {
      window.clearInterval(id);
    }
    this.restoreIntervals.clear();
  }
}
