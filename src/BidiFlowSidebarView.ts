import { ItemView, WorkspaceLeaf, MarkdownView, setTooltip } from 'obsidian';
import { BidiFlowNavigatorCore } from './BidiFlowNavigatorCore';
import { BidiFlowSettings } from './types';
import { t } from './i18n';

export const BIDI_FLOW_VIEW_TYPE = 'bidi-flow-navigator-view';

interface TabHeaderLeaf {
  tabHeaderEl?: HTMLElement;
  tabHeaderInnerTitleEl?: HTMLElement;
  updateHeader?: () => void;
}

export class BidiFlowSidebarView extends ItemView {
  public core!: BidiFlowNavigatorCore;
  private settings: BidiFlowSettings;
  private currentMarkdownView: MarkdownView | null = null;

  constructor(leaf: WorkspaceLeaf, settings: BidiFlowSettings) {
    super(leaf);
    this.settings = settings;
  }

  public getViewType(): string {
    return BIDI_FLOW_VIEW_TYPE;
  }

  public getDisplayText(): string {
    return t(this.settings.uiLanguage).viewTitle;
  }

  public getIcon(): string {
    return 'compass';
  }

  public async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass('bidi-sidebar-container');
    container.setAttribute('data-color-theme', this.settings.colorTheme || 'default');
    container.setAttribute('data-theme-style', this.settings.themeStyle || 'solid');

    this.core = this.addChild(new BidiFlowNavigatorCore(container, this.settings));
    this.core.hideWindowControls();

    // Set initial tab header tooltip according to current language
    this.updateTabHeader(t(this.settings.uiLanguage).viewTitle);

    // 1. Listen to active leaf changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        // If the newly active leaf is this sidebar view itself, keep the current markdown note attached!
        if (leaf === this.leaf) {
          if (this.currentMarkdownView && this.currentMarkdownView.containerEl.isConnected) {
            return;
          }
        }

        // If the active leaf is a MarkdownView, track and attach it
        if (leaf?.view instanceof MarkdownView) {
          this.currentMarkdownView = leaf.view;
          this.core.setView(leaf.view);
          return;
        }

        // If the active leaf is another panel/sidebar/settings, check if there's still an active or connected MarkdownView
        const activeMd = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeMd) {
          this.currentMarkdownView = activeMd;
          this.core.setView(activeMd);
        } else if (this.currentMarkdownView && this.currentMarkdownView.containerEl.isConnected) {
          // Keep showing headings for the active document without clearing
          this.core.setView(this.currentMarkdownView);
        } else {
          // Check if any open markdown tab exists
          const mdLeaves = this.app.workspace.getLeavesOfType('markdown');
          if (mdLeaves.length > 0 && mdLeaves[0].view instanceof MarkdownView) {
            this.currentMarkdownView = mdLeaves[0].view;
            this.core.setView(this.currentMarkdownView);
          } else {
            this.currentMarkdownView = null;
            this.core.setView(null);
          }
        }
      })
    );

    // 2. Refresh outline when note content changes
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (this.currentMarkdownView?.file?.path === file.path) {
          this.core.refreshHeadings();
        }
      })
    );

    // 3. Fallback on layout change
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        if (!this.currentMarkdownView || !this.currentMarkdownView.containerEl.isConnected) {
          const activeMd = this.app.workspace.getActiveViewOfType(MarkdownView);
          if (activeMd) {
            this.currentMarkdownView = activeMd;
            this.core.setView(activeMd);
          }
        }
      })
    );

    // Initial view set
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.currentMarkdownView = activeView;
      this.core.setView(activeView);
    } else {
      const mdLeaves = this.app.workspace.getLeavesOfType('markdown');
      if (mdLeaves.length > 0 && mdLeaves[0].view instanceof MarkdownView) {
        this.currentMarkdownView = mdLeaves[0].view;
        this.core.setView(this.currentMarkdownView);
      }
    }
  }

  public updateSettings(settings: BidiFlowSettings): void {
    this.settings = settings;
    const tr = t(settings.uiLanguage);
    this.updateTabHeader(tr.viewTitle);
    this.contentEl.setAttribute('data-color-theme', settings.colorTheme || 'default');
    this.contentEl.setAttribute('data-theme-style', settings.themeStyle || 'solid');
    this.core?.updateSettings(settings);
  }

  private updateTabHeader(title: string): void {
    const leafAny = this.leaf as unknown as TabHeaderLeaf;
    if (leafAny.tabHeaderEl) {
      leafAny.tabHeaderEl.setAttribute('aria-label', title);
      setTooltip(leafAny.tabHeaderEl, title);
    }
    if (leafAny.tabHeaderInnerTitleEl) {
      leafAny.tabHeaderInnerTitleEl.setText(title);
    }
    if (typeof leafAny.updateHeader === 'function') {
      leafAny.updateHeader();
    }
  }

  public async onClose(): Promise<void> {
    this.currentMarkdownView = null;
    this.core?.clear();
  }
}
