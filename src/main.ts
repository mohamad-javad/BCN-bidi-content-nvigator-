import { Plugin, MarkdownView, WorkspaceLeaf, setTooltip } from 'obsidian';
import { BidiFlowSettings, DEFAULT_SETTINGS } from './types';
import { BidiFlowSidebarView, BIDI_FLOW_VIEW_TYPE } from './BidiFlowSidebarView';
import { BidiFlowFloatingWidget } from './BidiFlowFloatingWidget';
import { BidiFlowSettingTab } from './settings';
import { t } from './i18n';

export default class BidiFlowNavigatorPlugin extends Plugin {
  public settings: BidiFlowSettings = DEFAULT_SETTINGS;
  private floatingWidgets: Map<MarkdownView, BidiFlowFloatingWidget> = new Map();
  private ribbonIconEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    const tr = t(this.settings.uiLanguage);

    // 1. Register Sidebar View
    this.registerView(
      BIDI_FLOW_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new BidiFlowSidebarView(leaf, this.settings)
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

    // Initial mount on workspace ready
    this.app.workspace.onLayoutReady(() => {
      this.syncFloatingWidgets();
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
          const widget = new BidiFlowFloatingWidget(view, this.settings);
          view.addChild(widget);
          this.floatingWidgets.set(view, widget);
        } else {
          this.floatingWidgets.get(view)?.refresh();
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

  onunload() {
    this.destroyAllFloatingWidgets();
  }
}
