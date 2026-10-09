import { Component, MarkdownView, setIcon, setTooltip, HeadingCache, Platform } from 'obsidian';
import { BidiFlowNavigatorCore } from './BidiFlowNavigatorCore';
import { BidiFlowSettings, NavigatorDisplayMode } from './types';
import { t } from './i18n';

export class BidiFlowFloatingWidget extends Component {
  public view: MarkdownView;
  private settings: BidiFlowSettings;
  private onHeadingChange?: (heading: HeadingCache) => void;
  private hostContainerEl!: HTMLElement;
  private cardEl!: HTMLElement;
  private toggleBtnEl!: HTMLElement;
  public core!: BidiFlowNavigatorCore;

  // 3-Mode State ('mini' | 'floating' | 'full-height')
  private currentMode: NavigatorDisplayMode;
  private previousExpandedMode: 'floating' | 'full-height' = 'floating';

  constructor(
    view: MarkdownView,
    settings: BidiFlowSettings,
    onHeadingChange?: (heading: HeadingCache) => void
  ) {
    super();
    this.view = view;
    this.settings = settings;
    this.onHeadingChange = onHeadingChange;
    this.currentMode = (Platform.isMobile && settings.defaultMode === 'full-height') ? 'floating' : (settings.defaultMode || 'floating');
    if (this.currentMode !== 'mini') {
      this.previousExpandedMode = this.currentMode;
    }
  }

  public onload(): void {
    this.mount();
  }

  private mount(): void {
    const parent = this.view.contentEl;
    if (!parent) return;

    this.hostContainerEl = parent.createDiv({
      cls: `bidi-floating-navigator is-side-${this.settings.floatingPosition} is-mode-${this.currentMode}`
    });

    if (this.currentMode === 'mini') {
      this.hostContainerEl.addClass('is-collapsed');
    }

    // Floating toggle pill (compass icon)
    const tr = t(this.settings.uiLanguage);
    this.toggleBtnEl = this.hostContainerEl.createDiv({
      cls: 'bidi-floating-toggle-btn clickable-icon',
      attr: { 'aria-label': tr.viewTitle }
    });
    setIcon(this.toggleBtnEl, 'compass');
    setTooltip(this.toggleBtnEl, tr.toggleNavigator);

    this.toggleBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMode(this.previousExpandedMode);
    });

    this.hostContainerEl.setAttribute('data-color-theme', this.settings.colorTheme || 'default');
    this.hostContainerEl.setAttribute('data-theme-style', this.settings.themeStyle || 'solid');

    // Navigator card container
    this.cardEl = this.hostContainerEl.createDiv({ cls: 'bidi-floating-card' });
    this.cardEl.setCssStyles({ width: `${this.settings.widgetWidth}px` });
    this.cardEl.setAttribute('data-color-theme', this.settings.colorTheme || 'default');
    this.cardEl.setAttribute('data-theme-style', this.settings.themeStyle || 'solid');

    // Isolate wheel events within floating card from bubbling to editor
    this.cardEl.addEventListener('wheel', (e) => {
      e.stopPropagation();
    }, { passive: true });

    // Instantiate core component
    this.core = this.addChild(new BidiFlowNavigatorCore(this.cardEl, this.settings));
    if (this.onHeadingChange) {
      this.core.setOnActiveHeadingChange(this.onHeadingChange);
    }

    // Wire up window control buttons from header
    this.core.setWindowControlHandlers(
      () => this.toggleMaximizeRestore(),
      () => this.setMode('mini')
    );
    this.core.updateWindowControls(this.currentMode);

    // Full-height mode is not available on mobile — hide the maximize button
    if (Platform.isMobile) {
      this.core.hideModeToggleButton();
    }

    this.core.setView(this.view);
  }

  public setMode(mode: NavigatorDisplayMode): void {
    if (this.currentMode === mode) return;

    if (this.currentMode !== 'mini') {
      this.previousExpandedMode = this.currentMode;
    }

    this.currentMode = mode;
    this.applyMode(mode);
  }

  private applyMode(mode: NavigatorDisplayMode): void {
    if (!this.hostContainerEl) return;

    this.hostContainerEl.removeClass('is-mode-mini', 'is-mode-floating', 'is-mode-full-height', 'is-collapsed');
    this.hostContainerEl.addClass(`is-mode-${mode}`);

    if (mode === 'mini') {
      this.hostContainerEl.addClass('is-collapsed');
    }

    this.core?.updateWindowControls(mode);

    if (mode !== 'mini') {
      this.refresh();
    }
  }

  public toggleMaximizeRestore(): void {
    if (Platform.isMobile) return;
    if (this.currentMode === 'floating') {
      this.setMode('full-height');
    } else if (this.currentMode === 'full-height') {
      this.setMode('floating');
    } else {
      this.setMode(this.previousExpandedMode);
    }
  }

  public toggleMini(): void {
    if (this.currentMode === 'mini') {
      this.setMode(this.previousExpandedMode);
    } else {
      this.setMode('mini');
    }
  }

  public cycleMode(): void {
    if (Platform.isMobile) {
      this.toggleMini();
      return;
    }
    if (this.currentMode === 'mini') {
      this.setMode('floating');
    } else if (this.currentMode === 'floating') {
      this.setMode('full-height');
    } else {
      this.setMode('mini');
    }
  }

  public getMode(): NavigatorDisplayMode {
    return this.currentMode;
  }

  public updateSettings(settings: BidiFlowSettings): void {
    this.settings = settings;
    if (this.hostContainerEl) {
      this.hostContainerEl.removeClass('is-side-left', 'is-side-right');
      this.hostContainerEl.addClass(`is-side-${settings.floatingPosition}`);
      this.hostContainerEl.setAttribute('data-color-theme', settings.colorTheme || 'default');
      this.hostContainerEl.setAttribute('data-theme-style', settings.themeStyle || 'solid');
    }
    if (this.cardEl) {
      this.cardEl.setCssStyles({ width: `${settings.widgetWidth}px` });
      this.cardEl.setAttribute('data-color-theme', settings.colorTheme || 'default');
      this.cardEl.setAttribute('data-theme-style', settings.themeStyle || 'solid');
    }
    if (this.toggleBtnEl) {
      const tr = t(settings.uiLanguage);
      this.toggleBtnEl.setAttribute('aria-label', tr.viewTitle);
      setTooltip(this.toggleBtnEl, tr.toggleNavigator);
    }
    this.core?.updateSettings(settings);
  }

  public refresh(): void {
    this.core?.refreshHeadings();
  }

  public onunload(): void {
    this.hostContainerEl?.remove();
  }
}
