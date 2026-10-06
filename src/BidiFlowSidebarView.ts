import { ItemView, WorkspaceLeaf, MarkdownView } from 'obsidian';
import { BidiFlowNavigatorCore } from './BidiFlowNavigatorCore';
import { BidiFlowSettings } from './types';
import { t } from './i18n';

export const BIDI_FLOW_VIEW_TYPE = 'bidi-flow-navigator-view';

export class BidiFlowSidebarView extends ItemView {
  public core!: BidiFlowNavigatorCore;
  private settings: BidiFlowSettings;

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

    this.core = this.addChild(new BidiFlowNavigatorCore(container, this.settings));
    this.core.hideWindowControls();

    // Listen to active leaf changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (leaf?.view instanceof MarkdownView) {
          this.core.setView(leaf.view);
        } else {
          this.core.setView(null);
        }
      })
    );

    // Initial view set
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      this.core.setView(activeView);
    }
  }

  public updateSettings(settings: BidiFlowSettings): void {
    this.settings = settings;
    this.core?.updateSettings(settings);
  }

  public async onClose(): Promise<void> {
    this.core?.clear();
  }
}
