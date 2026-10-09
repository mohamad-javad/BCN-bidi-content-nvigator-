import {
  Component,
  MarkdownView,
  setIcon,
  setTooltip,
  debounce,
  HeadingCache,
  MarkdownSubView
} from 'obsidian';
import { BidiHeadingNode, BidiFlowSettings, SectionNavigationDirection, SurroundingHeadings, NavigatorDisplayMode } from './types';
import { cleanHeadingText, toPersianDigits, isRtlText, detectDocumentDirection } from './utils';
import { getActiveHeading, getSurroundingHeadings, scrollToHeading, getCodeMirrorView, MarkdownPreviewViewWithScroll } from './scrollSpy';
import { t } from './i18n';

export class BidiFlowNavigatorCore extends Component {
  private static activeInstances: Set<BidiFlowNavigatorCore> = new Set();
  private static activeRunner: BidiFlowNavigatorCore | null = null;

  public containerEl: HTMLElement;
  private settings: BidiFlowSettings;

  // Header Elements
  private headerEl!: HTMLElement;
  private topBarEl?: HTMLElement;
  private modeToggleBtn?: HTMLButtonElement;
  private collapseBtn?: HTMLButtonElement;
  private prevBtnEl!: HTMLButtonElement;
  private nextBtnEl!: HTMLButtonElement;
  private currentBadgeEl!: HTMLElement;
  private currentLevelEl!: HTMLElement;
  private currentTitleEl!: HTMLElement;
  private counterEl!: HTMLElement;

  // Progress Bar
  private progressBarEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private progressTextEl!: HTMLElement;

  // Search Elements
  private searchContainerEl!: HTMLElement;
  private collapseAllBtn?: HTMLElement;
  private searchInputEl!: HTMLInputElement;

  // Tree Elements
  private treeContainerEl!: HTMLElement;
  private emptyStateEl!: HTMLElement;

  // Bottom Toolbar Elements (5 Buttons: Prev Sibling, Prev Part, Auto Scroll, Next Part, Next Sibling)
  private bottomToolbarEl!: HTMLElement;
  private prevSiblingBtnEl!: HTMLButtonElement;
  private prevPartBtnEl!: HTMLButtonElement;
  private autoScrollBtnEl!: HTMLButtonElement;
  private nextPartBtnEl!: HTMLButtonElement;
  private nextSiblingBtnEl!: HTMLButtonElement;

  // Auto Scroll Engine State
  private isAutoScrolling = false;
  private autoScrollRafId: number | null = null;
  private autoScrollLastTimestamp = 0;
  private autoScrollAccumulator = 0;

  // Data & State
  private rawHeadings: HeadingCache[] = [];
  private rootNodes: BidiHeadingNode[] = [];
  private flatNodes: BidiHeadingNode[] = [];
  private activeHeading: HeadingCache | null = null;
  private activeIndex: number = -1;
  private searchQuery: string = '';
  private currentView: MarkdownView | null = null;
  private headingElementMap: Map<string, HTMLElement> = new Map();
  private scrollCleanup: (() => void) | null = null;
  private rafId: number | null = null;
  private isUserInteractingWithTree = false;
  private isProgrammaticTreeScroll = false;
  private userScrollTimeout: number | null = null;
  private onActiveHeadingChange?: (heading: HeadingCache) => void;

  public setOnActiveHeadingChange(callback: (heading: HeadingCache) => void): void {
    this.onActiveHeadingChange = callback;
  }

  constructor(containerEl: HTMLElement, settings: BidiFlowSettings) {
    super();
    this.containerEl = containerEl;
    this.settings = settings;
  }

  // Window Control State
  private onToggleMaximizeCallback?: () => void;
  private onCollapseCallback?: () => void;
  private hideWindowControlsFlag = false;
  private currentWindowMode: NavigatorDisplayMode = 'floating';

  public onload(): void {
    BidiFlowNavigatorCore.activeInstances.add(this);
    this.buildSkeleton();
    this.registerDomEvents();
    if (BidiFlowNavigatorCore.activeRunner !== null) {
      this.updateAutoScrollUi(true);
    }
  }

  public updateSettings(newSettings: BidiFlowSettings): void {
    const langChanged = this.settings.uiLanguage !== newSettings.uiLanguage;
    this.settings = newSettings;
    this.applyTheme();
    if (langChanged) {
      this.buildSkeleton();
      this.registerDomEvents();
      this.updateWindowControls(this.currentWindowMode);
    }
    if (this.searchContainerEl) {
      this.searchContainerEl.toggleVisibility(this.settings.showSearch);
    }
    if (this.progressBarEl) {
      this.progressBarEl.toggleVisibility(this.settings.showProgressBar);
    }
    if (this.bottomToolbarEl) {
      this.bottomToolbarEl.toggleVisibility(this.settings.showBottomToolbar);
    }
    if (this.prevSiblingBtnEl) {
      this.prevSiblingBtnEl.toggleVisibility(this.settings.showPrevSiblingBtn);
    }
    if (this.prevPartBtnEl) {
      this.prevPartBtnEl.toggleVisibility(this.settings.showPrevPartBtn);
      const tr = t(this.settings.uiLanguage);
      const prevTip = this.settings.nextPartPageScroll ? tr.pageUp : tr.prevPart;
      setTooltip(this.prevPartBtnEl, prevTip);
      this.prevPartBtnEl.setAttribute('aria-label', prevTip);
    }
    if (this.autoScrollBtnEl) {
      this.autoScrollBtnEl.toggleVisibility(this.settings.showAutoScrollBtn);
    }
    if (this.nextPartBtnEl) {
      this.nextPartBtnEl.toggleVisibility(this.settings.showNextPartBtn);
      const tr = t(this.settings.uiLanguage);
      const nextTip = this.settings.nextPartPageScroll ? tr.pageDown : tr.nextPart;
      setTooltip(this.nextPartBtnEl, nextTip);
      this.nextPartBtnEl.setAttribute('aria-label', nextTip);
    }
    if (this.nextSiblingBtnEl) {
      this.nextSiblingBtnEl.toggleVisibility(this.settings.showNextSiblingBtn);
    }
    this.refreshHeadings();
  }

  public applyTheme(): void {
    const theme = this.settings.colorTheme || 'default';
    const style = this.settings.themeStyle || 'solid';
    this.containerEl.setAttribute('data-color-theme', theme);
    this.containerEl.setAttribute('data-theme-style', style);
  }

  private buildSkeleton(): void {
    const tr = t(this.settings.uiLanguage);
    this.containerEl.empty();
    this.containerEl.addClass('bidi-flow-navigator');
    this.applyTheme();

    // 1. Header Bar
    this.headerEl = this.containerEl.createDiv({ cls: 'bidi-flow-header' });

    // Top Bar (Branding & Mode Switching Controls)
    this.topBarEl = this.headerEl.createDiv({ cls: 'bidi-flow-top-bar' });
    if (this.hideWindowControlsFlag) {
      this.topBarEl.hide();
    }
    const brandEl = this.topBarEl.createDiv({ cls: 'bidi-flow-brand' });
    const brandIcon = brandEl.createSpan({ cls: 'bidi-flow-brand-icon' });
    setIcon(brandIcon, 'compass');
    brandEl.createSpan({ cls: 'bidi-flow-brand-text', text: tr.brand });

    const windowControlsEl = this.topBarEl.createDiv({ cls: 'bidi-flow-window-controls' });
    this.modeToggleBtn = windowControlsEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-btn-mode',
      attr: { 'aria-label': tr.toggleHeightFull }
    });
    setIcon(this.modeToggleBtn, this.currentWindowMode === 'full-height' ? 'minimize-2' : 'maximize-2');
    setTooltip(this.modeToggleBtn, this.currentWindowMode === 'full-height' ? tr.toggleHeightFloating : tr.toggleHeightFull);
    if (this.onToggleMaximizeCallback) {
      this.modeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onToggleMaximizeCallback?.();
      });
    }

    this.collapseBtn = windowControlsEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-btn-collapse',
      attr: { 'aria-label': tr.minimize }
    });
    setIcon(this.collapseBtn, 'minus');
    setTooltip(this.collapseBtn, tr.minimize);
    if (this.onCollapseCallback) {
      this.collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCollapseCallback?.();
      });
    }

    // Controls Row (Prev / Current / Next)
    const controlsRow = this.headerEl.createDiv({ cls: 'bidi-flow-controls-row' });

    // Prev Button
    this.prevBtnEl = controlsRow.createEl('button', {
      cls: 'clickable-icon bidi-flow-nav-btn bidi-flow-prev-btn',
      attr: { 'aria-label': tr.prevSection }
    });
    setIcon(this.prevBtnEl, 'chevron-left');
    setTooltip(this.prevBtnEl, tr.prevSection);

    // Current Section Badge
    this.currentBadgeEl = controlsRow.createDiv({ cls: 'bidi-flow-current-badge' });
    this.currentLevelEl = this.currentBadgeEl.createSpan({
      cls: 'bidi-flow-badge-level',
      text: '—'
    });
    this.currentTitleEl = this.currentBadgeEl.createSpan({
      cls: 'bidi-flow-current-title',
      text: tr.noActiveSection,
      attr: { dir: 'auto' }
    });
    this.counterEl = this.currentBadgeEl.createSpan({
      cls: 'bidi-flow-counter',
      text: '0/0'
    });

    // Next Button
    this.nextBtnEl = controlsRow.createEl('button', {
      cls: 'clickable-icon bidi-flow-nav-btn bidi-flow-next-btn',
      attr: { 'aria-label': tr.nextSection }
    });
    setIcon(this.nextBtnEl, 'chevron-right');
    setTooltip(this.nextBtnEl, tr.nextSection);

    // 2. Reading Progress Bar
    this.progressBarEl = this.headerEl.createDiv({ cls: 'bidi-flow-progress-wrapper' });
    if (!this.settings.showProgressBar) {
      this.progressBarEl.hide();
    }
    const track = this.progressBarEl.createDiv({ cls: 'bidi-flow-progress-track' });
    this.progressFillEl = track.createDiv({ cls: 'bidi-flow-progress-fill' });
    this.progressFillEl.setCssStyles({ width: '0%' });
    this.progressTextEl = this.progressBarEl.createSpan({
      cls: 'bidi-flow-progress-text',
      text: (this.settings.uiLanguage === 'fa' && this.settings.persianNumerals) ? '۰٪' : '0%'
    });

    // 3. Search / Filter Box
    this.searchContainerEl = this.containerEl.createDiv({ cls: 'bidi-flow-search-box' });
    if (!this.settings.showSearch) {
      this.searchContainerEl.hide();
    }

    // Collapse All / Expand All toggle button (like native Obsidian outline)
    this.collapseAllBtn = this.searchContainerEl.createSpan({
      cls: 'clickable-icon bidi-flow-collapse-all-btn',
      attr: { 'aria-label': tr.collapseAll }
    });
    setIcon(this.collapseAllBtn, 'chevrons-up-down');
    setTooltip(this.collapseAllBtn, tr.collapseAll);
    this.collapseAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapseAll();
    });

    const searchIcon = this.searchContainerEl.createSpan({ cls: 'bidi-flow-search-icon' });
    setIcon(searchIcon, 'search');

    this.searchInputEl = this.searchContainerEl.createEl('input', {
      type: 'search',
      cls: 'bidi-flow-search-input',
      placeholder: tr.filterPlaceholder,
      attr: { dir: 'auto', spellcheck: 'false' }
    });

    const clearBtn = this.searchContainerEl.createSpan({
      cls: 'clickable-icon bidi-flow-search-clear'
    });
    setIcon(clearBtn, 'x');
    clearBtn.addEventListener('click', () => {
      this.searchInputEl.value = '';
      this.onSearchChanged('');
    });

    // 4. Tree Container
    this.treeContainerEl = this.containerEl.createDiv({ cls: 'bidi-flow-tree-container' });

    // Empty state container
    this.emptyStateEl = this.containerEl.createDiv({
      cls: 'bidi-flow-empty-state',
      text: tr.noHeadings
    });
    this.emptyStateEl.hide();

    // 5. Bottom Action Toolbar (5 Buttons: Prev Sibling, Prev Part, Auto Scroll in Center, Next Part, Next Sibling)
    this.bottomToolbarEl = this.containerEl.createDiv({ cls: 'bidi-flow-bottom-toolbar' });
    if (!this.settings.showBottomToolbar) {
      this.bottomToolbarEl.hide();
    }

    // 1) Prev Sibling Button
    this.prevSiblingBtnEl = this.bottomToolbarEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-toolbar-btn bidi-flow-prev-sibling-btn',
      attr: { 'aria-label': tr.prevSibling }
    });
    setIcon(this.prevSiblingBtnEl, 'skip-back');
    setTooltip(this.prevSiblingBtnEl, tr.prevSibling);
    if (!this.settings.showPrevSiblingBtn) {
      this.prevSiblingBtnEl.hide();
    }

    // 2) Prev Part Button
    const prevPartTip = this.settings.nextPartPageScroll ? tr.pageUp : tr.prevPart;
    this.prevPartBtnEl = this.bottomToolbarEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-toolbar-btn bidi-flow-prev-part-btn',
      attr: { 'aria-label': prevPartTip }
    });
    setIcon(this.prevPartBtnEl, 'chevron-up');
    setTooltip(this.prevPartBtnEl, prevPartTip);
    if (!this.settings.showPrevPartBtn) {
      this.prevPartBtnEl.hide();
    }

    // 3) Auto Scroll Button (CENTER!)
    this.autoScrollBtnEl = this.bottomToolbarEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-toolbar-btn bidi-flow-auto-scroll-btn',
      attr: { 'aria-label': tr.autoScrollStart }
    });
    setIcon(this.autoScrollBtnEl, 'play');
    setTooltip(this.autoScrollBtnEl, tr.autoScrollStart);
    if (!this.settings.showAutoScrollBtn) {
      this.autoScrollBtnEl.hide();
    }

    // 4) Next Part Button (Smart Page / Heading Jump)
    const nextPartTip = this.settings.nextPartPageScroll ? tr.pageDown : tr.nextPart;
    this.nextPartBtnEl = this.bottomToolbarEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-toolbar-btn bidi-flow-next-part-btn',
      attr: { 'aria-label': nextPartTip }
    });
    setIcon(this.nextPartBtnEl, 'chevron-down');
    setTooltip(this.nextPartBtnEl, nextPartTip);
    if (!this.settings.showNextPartBtn) {
      this.nextPartBtnEl.hide();
    }

    // 5) Next Sibling Button
    this.nextSiblingBtnEl = this.bottomToolbarEl.createEl('button', {
      cls: 'clickable-icon bidi-flow-btn bidi-flow-toolbar-btn bidi-flow-next-sibling-btn',
      attr: { 'aria-label': tr.nextSibling }
    });
    setIcon(this.nextSiblingBtnEl, 'skip-forward');
    setTooltip(this.nextSiblingBtnEl, tr.nextSibling);
    if (!this.settings.showNextSiblingBtn) {
      this.nextSiblingBtnEl.hide();
    }
  }

  private registerDomEvents(): void {
    // Navigation jumps
    this.prevBtnEl.addEventListener('click', () => this.jumpSection('prev'));
    this.nextBtnEl.addEventListener('click', () => this.jumpSection('next'));

    // Toolbar actions (5 Buttons)
    this.prevSiblingBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.jumpPrevSibling();
    });
    this.prevPartBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.jumpPrevPart();
    });
    this.autoScrollBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAutoScroll();
    });
    this.nextPartBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.jumpNextPart();
    });
    this.nextSiblingBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.jumpNextSibling();
    });

    // Search filter
    const debouncedFilter = debounce((query: string) => {
      this.onSearchChanged(query);
    }, 100, true);

    this.searchInputEl.addEventListener('input', (e) => {
      if (e.target instanceof HTMLInputElement) {
        debouncedFilter(e.target.value);
      }
    });

    // Handle user interaction and scrolling on the tree container
    this.treeContainerEl.addEventListener('mouseenter', () => {
      this.isUserInteractingWithTree = true;
    });
    this.treeContainerEl.addEventListener('mouseleave', () => {
      this.isUserInteractingWithTree = false;
    });
    this.treeContainerEl.addEventListener('wheel', (e) => {
      e.stopPropagation();
      this.isUserInteractingWithTree = true;
      if (this.userScrollTimeout !== null) {
        window.clearTimeout(this.userScrollTimeout);
      }
      this.userScrollTimeout = window.setTimeout(() => {
        this.isUserInteractingWithTree = false;
        this.userScrollTimeout = null;
      }, 1000);
    }, { passive: true });
    this.treeContainerEl.addEventListener('scroll', (e) => {
      e.stopPropagation();
      if (this.isProgrammaticTreeScroll) return;
      this.isUserInteractingWithTree = true;
      if (this.userScrollTimeout !== null) {
        window.clearTimeout(this.userScrollTimeout);
      }
      this.userScrollTimeout = window.setTimeout(() => {
        this.isUserInteractingWithTree = false;
        this.userScrollTimeout = null;
      }, 800);
    }, { passive: true });
  }

  public setView(view: MarkdownView | null): void {
    if (this.currentView === view && view !== null) {
      this.attachScrollListener();
      this.refreshHeadings();
      return;
    }

    this.detachScrollListener();
    this.currentView = view;

    if (!view) {
      this.clear();
      return;
    }

    this.refreshHeadings();
    this.attachScrollListener();
  }

  public refreshHeadings(): void {
    if (!this.currentView) {
      this.clear();
      return;
    }

    const file = this.currentView.file;
    if (!file) {
      this.clear();
      return;
    }

    const metadata = this.currentView.app.metadataCache.getFileCache(file);
    const raw = metadata?.headings ?? [];

    // Filter by maxHeadingLevel
    this.rawHeadings = raw.filter(h => h.level <= this.settings.maxHeadingLevel);

    if (this.rawHeadings.length === 0) {
      this.rootNodes = [];
      this.flatNodes = [];
      this.activeHeading = null;
      this.activeIndex = -1;
      this.treeContainerEl.empty();
      this.emptyStateEl.show();
      this.updateHeaderDisplay(null);
      this.updateProgressBar(0);
      return;
    }

    this.emptyStateEl.hide();
    this.buildHeadingTree(this.rawHeadings);
    this.renderTree();
    this.syncActiveHeading();
  }

  private buildHeadingTree(headings: HeadingCache[]): void {
    this.rootNodes = [];
    this.flatNodes = [];
    const stack: BidiHeadingNode[] = [];

    const tr = t(this.settings.uiLanguage);
    headings.forEach((heading, idx) => {
      const cleaned = cleanHeadingText(heading.heading) || tr.untitled;
      const node: BidiHeadingNode = {
        id: `bidi-h-${heading.position.start.line}-${idx}`,
        heading,
        level: heading.level,
        text: cleaned,
        line: heading.position.start.line,
        parent: null,
        children: [],
        isCollapsed: false,
        isVisible: true
      };

      this.flatNodes.push(node);

      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        this.rootNodes.push(node);
      } else {
        node.parent = stack[stack.length - 1];
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });
  }

  private renderTree(): void {
    this.treeContainerEl.empty();
    this.headingElementMap.clear();

    const docDir = detectDocumentDirection(this.rawHeadings, this.currentView?.file?.basename);
    this.treeContainerEl.setAttribute('dir', docDir);
    this.treeContainerEl.classList.toggle('is-doc-rtl', docDir === 'rtl');
    this.treeContainerEl.classList.toggle('is-doc-ltr', docDir === 'ltr');
    this.treeContainerEl.setCssProps({
      '--bidi-indent-guide-offset': `${this.settings.indentStepPx}px`
    });
    this.containerEl.setAttribute('data-doc-dir', docDir);

    const renderBranch = (nodes: BidiHeadingNode[], parentEl: HTMLElement) => {
      for (const node of nodes) {
        if (!node.isVisible) continue;

        // Tree Item container (hierarchical element)
        const itemEl = parentEl.createDiv({
          cls: `tree-item bidi-flow-tree-item bidi-level-${node.level}`,
          attr: {
            'data-heading-id': node.id,
            'data-level': node.level.toString()
          }
        });

        // Clickable self row matching Obsidian's native tree-item-self
        const rowEl = itemEl.createDiv({
          cls: `tree-item-self is-clickable bidi-flow-tree-row bidi-flow-tree-node`,
          attr: {
            'data-heading-id': node.id,
            'data-line': node.line.toString()
          }
        });

        // Collapse / Expand toggle button (chevron icon)
        if (node.children.length > 0) {
          const toggleEl = rowEl.createDiv({
            cls: `tree-item-icon collapse-icon bidi-flow-toggle-icon ${node.isCollapsed ? 'is-collapsed' : ''}`
          });
          const collapseIconName = node.isCollapsed
            ? (docDir === 'rtl' ? 'chevron-left' : 'chevron-right')
            : 'chevron-down';
          setIcon(toggleEl, collapseIconName);
          toggleEl.addEventListener('click', (e) => {
            e.stopPropagation();
            node.isCollapsed = !node.isCollapsed;
            this.renderTree();
          });
        }

        // Level Badge (H1, H2 or ۱, ۲) if enabled
        if (this.settings.showLevelBadge) {
          const badgeText = this.settings.persianNumerals
            ? `H${toPersianDigits(node.level, true)}`
            : `H${node.level}`;
          rowEl.createSpan({
            cls: `bidi-flow-level-pill level-${node.level}`,
            text: badgeText
          });
        }

        // Heading Title with dir="auto"
        const isRtl = isRtlText(node.text);
        rowEl.createDiv({
          cls: `tree-item-inner bidi-flow-node-title ${isRtl ? 'is-rtl' : 'is-ltr'}`,
          text: node.text,
          attr: { dir: 'auto' }
        });

        // Tooltip displaying complete title for long words / titles
        setTooltip(rowEl, `[H${node.level}] ${node.text}`);

        this.headingElementMap.set(node.id, rowEl);

        // Click handler to jump to section
        rowEl.addEventListener('click', () => {
          this.jumpToSpecificHeading(node.heading);
        });

        // Render nested children if expanded
        if (node.children.length > 0 && !node.isCollapsed) {
          const childContainer = itemEl.createDiv({
            cls: 'tree-item-children bidi-flow-children-container bidi-flow-tree-children'
          });
          renderBranch(node.children, childContainer);
        }
      }
    };

    renderBranch(this.rootNodes, this.treeContainerEl);

    // Re-highlight active node
    if (this.activeIndex >= 0 && this.flatNodes[this.activeIndex]) {
      this.highlightNode(this.flatNodes[this.activeIndex]);
    }

    this.updateCollapseAllIcon();
  }

  public toggleCollapseAll(): void {
    const anyExpanded = this.flatNodes.some(n => n.children.length > 0 && !n.isCollapsed);
    const shouldCollapse = anyExpanded;

    const setCollapseRecursive = (nodes: BidiHeadingNode[]) => {
      for (const node of nodes) {
        if (node.children.length > 0) {
          node.isCollapsed = shouldCollapse;
          setCollapseRecursive(node.children);
        }
      }
    };

    setCollapseRecursive(this.rootNodes);
    this.updateCollapseAllIcon();
    this.renderTree();
  }

  private updateCollapseAllIcon(): void {
    if (!this.collapseAllBtn) return;
    const hasBranches = this.flatNodes.some(n => n.children.length > 0);
    if (!hasBranches) {
      this.collapseAllBtn.addClass('is-disabled');
      return;
    }
    this.collapseAllBtn.removeClass('is-disabled');
    const anyExpanded = this.flatNodes.some(n => n.children.length > 0 && !n.isCollapsed);
    const tr = t(this.settings.uiLanguage);
    const tooltip = anyExpanded ? tr.collapseAll : tr.expandAll;
    const iconName = anyExpanded ? 'chevrons-up-down' : 'chevrons-down-up';
    setIcon(this.collapseAllBtn, iconName);
    this.collapseAllBtn.setAttribute('aria-label', tooltip);
    setTooltip(this.collapseAllBtn, tooltip);
  }

  private onSearchChanged(query: string): void {
    this.searchQuery = query.trim().toLowerCase();

    if (!this.searchQuery) {
      this.flatNodes.forEach(n => (n.isVisible = true));
      this.renderTree();
      return;
    }

    const filterNode = (node: BidiHeadingNode): boolean => {
      const matchSelf = node.text.toLowerCase().includes(this.searchQuery);
      let matchChild = false;

      for (const child of node.children) {
        if (filterNode(child)) {
          matchChild = true;
        }
      }

      node.isVisible = matchSelf || matchChild;
      if (matchChild) {
        node.isCollapsed = false; // Auto-expand matching branches
      }
      return node.isVisible;
    };

    for (const root of this.rootNodes) {
      filterNode(root);
    }

    this.renderTree();
  }

  private attachScrollListener(): void {
    this.detachScrollListener();
    if (!this.currentView) return;

    const onScroll = (e?: Event) => {
      // If the scroll/wheel event came from inside the navigator itself, ignore it!
      if (e?.target && this.containerEl && this.containerEl.contains(e.target as Node)) {
        return;
      }
      if (this.rafId !== null) return;
      this.rafId = window.requestAnimationFrame(() => {
        this.rafId = null;
        this.syncActiveHeading(e != null);
      });
    };

    const cleanups: (() => void)[] = [];

    // Capture scroll events on containerEl and contentEl
    // Scroll events don't bubble, but capture phase travels through all ancestors
    const container = this.currentView.containerEl;
    if (container) {
      container.addEventListener('scroll', onScroll, { capture: true, passive: true });
      container.addEventListener('wheel', onScroll, { passive: true });
      cleanups.push(() => {
        container.removeEventListener('scroll', onScroll, { capture: true });
        container.removeEventListener('wheel', onScroll);
      });
    }

    const content = this.currentView.contentEl;
    if (content && content !== container) {
      content.addEventListener('scroll', onScroll, { capture: true, passive: true });
      cleanups.push(() => content.removeEventListener('scroll', onScroll, { capture: true }));
    }

    const cmScroller = content?.querySelector<HTMLElement>('.cm-scroller');
    if (cmScroller) {
      cmScroller.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => cmScroller.removeEventListener('scroll', onScroll));
    }

    const previewEl = content?.querySelector<HTMLElement>('.markdown-preview-view')
      ?? (this.currentView.previewMode as unknown as { containerEl?: HTMLElement })?.containerEl?.querySelector<HTMLElement>('.markdown-preview-view')
      ?? this.currentView.previewMode?.containerEl;
    if (previewEl) {
      previewEl.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => previewEl.removeEventListener('scroll', onScroll));
    }

    this.scrollCleanup = () => {
      for (const fn of cleanups) {
        fn();
      }
    };

    // Initial sync
    onScroll();
  }

  private detachScrollListener(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.userScrollTimeout !== null) {
      window.clearTimeout(this.userScrollTimeout);
      this.userScrollTimeout = null;
    }
    if (this.scrollCleanup) {
      this.scrollCleanup();
      this.scrollCleanup = null;
    }
  }

  private syncActiveHeading(notify = false): void {
    if (!this.currentView || this.rawHeadings.length === 0) return;

    const active = getActiveHeading(this.currentView, this.rawHeadings, 60);
    this.activeHeading = active;
    if (active && notify) {
      this.onActiveHeadingChange?.(active);
    }

    const surrounding = getSurroundingHeadings(this.rawHeadings, active);
    this.activeIndex = surrounding.activeIndex;

    this.updateHeaderDisplay(surrounding);
    this.highlightActiveInTree();
    this.calculateReadingProgress();
  }

  private updateHeaderDisplay(surrounding: SurroundingHeadings | null): void {
    const tr = t(this.settings.uiLanguage);
    const usePersianDigits = this.settings.uiLanguage === 'fa' && this.settings.persianNumerals;

    if (!surrounding || !surrounding.active) {
      this.currentLevelEl.setText('—');
      this.currentTitleEl.setText(tr.noActiveSection);
      this.counterEl.setText(usePersianDigits ? '۰/۰' : '0/0');
      this.prevBtnEl.disabled = true;
      this.nextBtnEl.disabled = true;
      this.prevBtnEl.addClass('is-disabled');
      this.nextBtnEl.addClass('is-disabled');
      this.prevBtnEl.setAttribute('aria-label', tr.docStart);
      this.nextBtnEl.setAttribute('aria-label', tr.docEnd);
      setTooltip(this.prevBtnEl, tr.docStart);
      setTooltip(this.nextBtnEl, tr.docEnd);
      return;
    }

    const { active, prev, next, activeIndex, totalCount } = surrounding;

    // Level badge
    const lvlText = usePersianDigits
      ? `H${toPersianDigits(active.level, true)}`
      : `H${active.level}`;
    this.currentLevelEl.setText(lvlText);

    // Title
    const cleanedTitle = cleanHeadingText(active.heading) || tr.untitled;
    this.currentTitleEl.setText(cleanedTitle);
    const badgeLabel = `[H${active.level}] ${cleanedTitle}`;
    this.currentBadgeEl.setAttribute('aria-label', badgeLabel);
    setTooltip(this.currentBadgeEl, badgeLabel);

    // Section counter
    const idxNum = activeIndex + 1;
    const counterStr = usePersianDigits
      ? `${toPersianDigits(idxNum, true)} / ${toPersianDigits(totalCount, true)}`
      : `${idxNum} / ${totalCount}`;
    this.counterEl.setText(counterStr);

    // Prev / Next button states & tooltips
    if (prev) {
      this.prevBtnEl.disabled = false;
      this.prevBtnEl.removeClass('is-disabled');
      const prevTitle = cleanHeadingText(prev.heading) || tr.untitled;
      const prevTip = tr.prevTooltip(prevTitle, prev.level);
      this.prevBtnEl.setAttribute('aria-label', prevTip);
      setTooltip(this.prevBtnEl, prevTip);
    } else {
      this.prevBtnEl.disabled = true;
      this.prevBtnEl.addClass('is-disabled');
      this.prevBtnEl.setAttribute('aria-label', tr.docStart);
      setTooltip(this.prevBtnEl, tr.docStart);
    }

    if (next) {
      this.nextBtnEl.disabled = false;
      this.nextBtnEl.removeClass('is-disabled');
      const nextTitle = cleanHeadingText(next.heading) || tr.untitled;
      const nextTip = tr.nextTooltip(nextTitle, next.level);
      this.nextBtnEl.setAttribute('aria-label', nextTip);
      setTooltip(this.nextBtnEl, nextTip);
    } else {
      this.nextBtnEl.disabled = true;
      this.nextBtnEl.addClass('is-disabled');
      this.nextBtnEl.setAttribute('aria-label', tr.docEnd);
      setTooltip(this.nextBtnEl, tr.docEnd);
    }
  }

  private highlightActiveInTree(): void {
    // Remove active class from all
    for (const el of this.headingElementMap.values()) {
      el.removeClass('is-active');
    }

    if (this.activeIndex >= 0 && this.flatNodes[this.activeIndex]) {
      const activeNode = this.flatNodes[this.activeIndex];
      let p = activeNode.parent;
      let neededReRender = false;
      while (p) {
        if (p.isCollapsed) {
          p.isCollapsed = false;
          neededReRender = true;
        }
        p = p.parent;
      }
      if (neededReRender) {
        this.renderTree();
        return;
      }
      this.highlightNode(activeNode);
    }
  }

  private highlightNode(node: BidiHeadingNode, shouldScrollIntoView = true): void {
    const el = this.headingElementMap.get(node.id);
    if (!el) return;

    el.addClass('is-active');

    // If user is actively hovering or scrolling the tree, do not force-scroll the tree
    if (!shouldScrollIntoView || this.isUserInteractingWithTree || !this.treeContainerEl) {
      return;
    }

    // Scroll ONLY this.treeContainerEl without affecting any ancestor elements
    const container = this.treeContainerEl;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    this.isProgrammaticTreeScroll = true;
    if (elRect.top < containerRect.top) {
      container.scrollTop -= (containerRect.top - elRect.top + 8);
    } else if (elRect.bottom > containerRect.bottom) {
      container.scrollTop += (elRect.bottom - containerRect.bottom + 8);
    }
    window.requestAnimationFrame(() => {
      this.isProgrammaticTreeScroll = false;
    });
  }

  public setWindowControlHandlers(
    onToggleMaximize: () => void,
    onCollapse: () => void
  ): void {
    this.onToggleMaximizeCallback = onToggleMaximize;
    this.onCollapseCallback = onCollapse;
    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggleMaximize();
      });
    }
    if (this.collapseBtn) {
      this.collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        onCollapse();
      });
    }
  }

  public updateWindowControls(mode: NavigatorDisplayMode): void {
    this.currentWindowMode = mode;
    if (!this.modeToggleBtn) return;
    const tr = t(this.settings.uiLanguage);
    if (mode === 'full-height') {
      setIcon(this.modeToggleBtn, 'minimize-2');
      setTooltip(this.modeToggleBtn, tr.toggleHeightFloating);
    } else {
      setIcon(this.modeToggleBtn, 'maximize-2');
      setTooltip(this.modeToggleBtn, tr.toggleHeightFull);
    }
  }

  public hideWindowControls(): void {
    this.hideWindowControlsFlag = true;
    if (this.topBarEl) {
      this.topBarEl.hide();
    }
  }

  private calculateReadingProgress(): void {
    if (!this.currentView) return;

    let percent = 0;
    const scrollContainer = this.getScrollContainer(this.currentView);
    if (scrollContainer) {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll > 10) {
        if (scrollContainer.scrollTop <= 5) {
          percent = 0;
        } else if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10) {
          percent = 100;
        } else {
          percent = Math.round((scrollContainer.scrollTop / maxScroll) * 100);
        }
      }
    }

    // Line-based fallback
    if (percent === 0 && this.currentView.editor) {
      try {
        const lineCount = this.currentView.editor.lineCount();
        const subView = (this.currentView as unknown as { currentMode?: MarkdownSubView }).currentMode;
        const currentLine = typeof subView?.getScroll === 'function'
          ? subView.getScroll()
          : (this.activeHeading ? this.activeHeading.position.start.line : 0);

        if (lineCount > 1 && currentLine > 0) {
          percent = Math.round((currentLine / (lineCount - 1)) * 100);
        }
      } catch {
        // Ignore
      }
    }

    percent = Math.min(100, Math.max(0, percent));
    this.updateProgressBar(percent);
  }

  private updateProgressBar(percent: number): void {
    if (!this.progressFillEl || !this.progressTextEl) return;
    this.progressFillEl.setCssStyles({ width: `${percent}%` });
    const usePersianDigits = this.settings.uiLanguage === 'fa' && this.settings.persianNumerals;
    const percentStr = usePersianDigits
      ? `${toPersianDigits(percent, true)}٪`
      : `${percent}%`;
    this.progressTextEl.setText(percentStr);
  }

  public jumpSection(direction: SectionNavigationDirection): void {
    if (!this.currentView || this.rawHeadings.length === 0) return;

    const surrounding = getSurroundingHeadings(this.rawHeadings, this.activeHeading);
    const target = direction === 'prev' ? surrounding.prev : surrounding.next;

    if (target) {
      this.jumpToSpecificHeading(target);
    }
  }

  public jumpToSpecificHeading(target: HeadingCache): void {
    if (!this.currentView) return;
    this.stopAutoScroll();
    this.isUserInteractingWithTree = false;

    // Instantly update active heading, UI badge, tree highlight, and progress bar
    this.activeHeading = target;
    this.onActiveHeadingChange?.(target);
    const targetSurrounding = getSurroundingHeadings(this.rawHeadings, target);
    this.activeIndex = targetSurrounding.activeIndex;
    this.updateHeaderDisplay(targetSurrounding);
    this.highlightActiveInTree();
    this.calculateReadingProgress();

    scrollToHeading(this.currentView, target, 'smooth');
    if (this.currentView.getMode() !== 'preview') {
      this.currentView.editor?.focus();
    }
  }

  public getActiveMarkdownView(): MarkdownView | null {
    if (this.currentView && this.currentView.containerEl.isConnected) {
      return this.currentView;
    }
    const app = (this.containerEl.ownerDocument?.defaultView as unknown as { app?: { workspace?: { getActiveViewOfType: (type: typeof MarkdownView) => MarkdownView | null } } })?.app;
    const active = app?.workspace?.getActiveViewOfType(MarkdownView);
    if (active && active.containerEl.isConnected) {
      this.currentView = active;
      return active;
    }
    return this.currentView;
  }

  public getPageSizeInLines(): number {
    const view = this.getActiveMarkdownView();
    if (view) {
      const scrollContainer = this.getScrollContainer(view);
      if (scrollContainer && scrollContainer.clientHeight > 100) {
        return Math.max(12, Math.round((scrollContainer.clientHeight / 24) * 0.85));
      }
    }
    return 25;
  }

  public getCurrentScrollLine(): number {
    const view = this.getActiveMarkdownView();
    if (!view) return this.activeHeading ? this.activeHeading.position.start.line : 0;

    const subView = (view as unknown as { currentMode?: MarkdownSubView; editMode?: MarkdownSubView }).currentMode ??
                    (view as unknown as { editMode?: MarkdownSubView }).editMode;

    if (typeof subView?.getScroll === 'function') {
      try {
        const line = subView.getScroll();
        if (typeof line === 'number' && !isNaN(line)) {
          return line;
        }
      } catch {
        // Ignore
      }
    }

    if (this.activeHeading) {
      return this.activeHeading.position.start.line;
    }

    const editor = view.editor;
    if (editor) {
      try {
        return editor.getCursor().line;
      } catch {
        // Ignore
      }
    }

    return 0;
  }

  public scrollToLine(targetLine: number): void {
    const view = this.getActiveMarkdownView();
    if (!view) return;
    this.stopAutoScroll();

    const mode = view.getMode();
    if (mode === 'preview') {
      const preview = view.previewMode;

      try {
        const previewRenderer = (preview as unknown as { renderer?: { applyScrollDelayed?: (line: number) => void; applyScroll?: (line: number) => boolean } })?.renderer;
        if (typeof previewRenderer?.applyScrollDelayed === 'function') {
          previewRenderer.applyScrollDelayed(targetLine);
        } else if (typeof (preview as unknown as MarkdownPreviewViewWithScroll)?.applyScroll === 'function') {
          (preview as unknown as MarkdownPreviewViewWithScroll).applyScroll!(targetLine);
        }
      } catch {
        // Ignore
      }

      const scrollContainer = this.getScrollContainer(view);
      if (scrollContainer) {
        const lineCount = view.file ? (this.rawHeadings.length > 0 ? Math.max(100, this.rawHeadings[this.rawHeadings.length - 1].position.end.line) : 100) : 100;
        const ratio = targetLine / Math.max(1, lineCount);
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const targetScrollTop = Math.min(maxScroll, Math.round(ratio * scrollContainer.scrollHeight));
        scrollContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      }
    } else {
      const subView = (view as unknown as { currentMode?: MarkdownSubView; editMode?: MarkdownSubView }).currentMode ??
                      (view as unknown as { editMode?: MarkdownSubView }).editMode;

      if (typeof subView?.applyScroll === 'function') {
        subView.applyScroll(targetLine);
      }

      const editor = view.editor;
      if (editor) {
        try {
          editor.scrollIntoView(
            { from: { line: targetLine, ch: 0 }, to: { line: targetLine, ch: 0 } },
            false
          );
        } catch {
          // Ignore
        }
      }

      const scroller = view.contentEl.querySelector<HTMLElement>('.cm-scroller');
      if (scroller && editor) {
        const cm = getCodeMirrorView(editor);
        if (cm?.state?.doc) {
          const line1 = Math.min(cm.state.doc.lines, Math.max(1, targetLine + 1));
          const linePos = cm.state.doc.line(line1).from;
          const block = cm.lineBlockAt ? cm.lineBlockAt(linePos) : null;
          if (block) {
            scroller.scrollTo({ top: block.top, behavior: 'smooth' });
          }
        }
      }
    }
  }

  public getScrollContainer(view: MarkdownView | null): HTMLElement | null {
    if (!view) return null;
    if (view.getMode() === 'preview') {
      const previewEl = view.contentEl.querySelector<HTMLElement>('.markdown-preview-view')
        ?? (view.previewMode as unknown as { containerEl?: HTMLElement })?.containerEl?.querySelector<HTMLElement>('.markdown-preview-view')
        ?? view.previewMode?.containerEl;
      return previewEl ?? null;
    } else {
      const cmScroller = view.contentEl.querySelector<HTMLElement>('.cm-scroller');
      return cmScroller ?? view.contentEl;
    }
  }

  public toggleAutoScroll(): void {
    if (BidiFlowNavigatorCore.activeRunner !== null) {
      BidiFlowNavigatorCore.activeRunner.stopAutoScroll();
    } else {
      this.startAutoScroll();
    }
  }

  public startAutoScroll(): void {
    const view = this.getActiveMarkdownView();
    if (!view) return;

    if (BidiFlowNavigatorCore.activeRunner && BidiFlowNavigatorCore.activeRunner !== this) {
      BidiFlowNavigatorCore.activeRunner.stopAutoScroll();
    }

    BidiFlowNavigatorCore.activeRunner = this;
    this.isAutoScrolling = true;
    this.autoScrollAccumulator = 0;

    BidiFlowNavigatorCore.broadcastAutoScrollState(true);
    this.autoScrollLastTimestamp = performance.now();

    let atBottomFrames = 0;
    let emptyDocFrames = 0;

    const step = (now: number) => {
      if (!this.isAutoScrolling || BidiFlowNavigatorCore.activeRunner !== this) {
        return;
      }

      const currentView = this.getActiveMarkdownView();
      if (!currentView) {
        this.stopAutoScroll();
        return;
      }

      const scrollContainer = this.getScrollContainer(currentView);
      if (!scrollContainer) {
        this.autoScrollRafId = window.requestAnimationFrame(step);
        return;
      }

      const deltaMs = Math.min(100, Math.max(1, now - this.autoScrollLastTimestamp));
      this.autoScrollLastTimestamp = now;

      const speed = Math.max(5, this.settings.autoScrollSpeed || 30);
      const deltaPx = (speed * deltaMs) / 1000;

      const maxScroll = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);

      if (maxScroll <= 5) {
        emptyDocFrames++;
        if (emptyDocFrames > 60) {
          this.stopAutoScroll();
          return;
        }
        this.autoScrollRafId = window.requestAnimationFrame(step);
        return;
      } else {
        emptyDocFrames = 0;
      }

      const isAtBottom = scrollContainer.scrollTop >= maxScroll - 3;
      if (isAtBottom) {
        atBottomFrames++;
        if (atBottomFrames > 30) {
          this.stopAutoScroll();
          return;
        }
      } else {
        atBottomFrames = 0;
        this.autoScrollAccumulator += deltaPx;
        if (this.autoScrollAccumulator >= 1) {
          const pxToScroll = Math.floor(this.autoScrollAccumulator);
          this.autoScrollAccumulator -= pxToScroll;
          scrollContainer.scrollTop += pxToScroll;
        }
      }

      this.autoScrollRafId = window.requestAnimationFrame(step);
    };

    if (this.autoScrollRafId !== null) {
      window.cancelAnimationFrame(this.autoScrollRafId);
    }
    this.autoScrollRafId = window.requestAnimationFrame(step);
  }

  public stopAutoScroll(): void {
    if (this.autoScrollRafId !== null) {
      window.cancelAnimationFrame(this.autoScrollRafId);
      this.autoScrollRafId = null;
    }
    this.isAutoScrolling = false;
    this.autoScrollAccumulator = 0;
    if (BidiFlowNavigatorCore.activeRunner === this) {
      BidiFlowNavigatorCore.activeRunner = null;
    }

    BidiFlowNavigatorCore.broadcastAutoScrollState(false);
  }

  public static broadcastAutoScrollState(isRunning: boolean): void {
    for (const instance of BidiFlowNavigatorCore.activeInstances) {
      instance.updateAutoScrollUi(isRunning);
    }
  }

  public static isAnyAutoScrolling(): boolean {
    return BidiFlowNavigatorCore.activeRunner !== null;
  }

  public static stopAllAutoScroll(): void {
    if (BidiFlowNavigatorCore.activeRunner) {
      BidiFlowNavigatorCore.activeRunner.stopAutoScroll();
    }
  }

  public updateAutoScrollUi(isRunning: boolean): void {
    this.isAutoScrolling = isRunning;
    if (!this.autoScrollBtnEl) return;
    const tr = t(this.settings.uiLanguage);
    if (isRunning) {
      this.autoScrollBtnEl.addClass('is-active');
      setIcon(this.autoScrollBtnEl, 'pause');
      setTooltip(this.autoScrollBtnEl, tr.autoScrollStop);
      this.autoScrollBtnEl.setAttribute('aria-label', tr.autoScrollStop);
    } else {
      this.autoScrollBtnEl.removeClass('is-active');
      setIcon(this.autoScrollBtnEl, 'play');
      setTooltip(this.autoScrollBtnEl, tr.autoScrollStart);
      this.autoScrollBtnEl.setAttribute('aria-label', tr.autoScrollStart);
    }
  }

  public scrollPage(direction: 'down' | 'up'): void {
    const view = this.getActiveMarkdownView();
    if (!view) return;
    this.stopAutoScroll();

    const scrollContainer = this.getScrollContainer(view);
    if (scrollContainer && scrollContainer.clientHeight > 50) {
      const pageDelta = Math.round(scrollContainer.clientHeight * 0.85);
      scrollContainer.scrollBy({
        top: direction === 'down' ? pageDelta : -pageDelta,
        behavior: 'smooth',
      });
    } else {
      const currentLine = this.getCurrentScrollLine();
      const pageSize = this.getPageSizeInLines();
      const totalLines = view.editor ? view.editor.lineCount() : 1000;
      const targetLine = direction === 'down'
        ? Math.min(totalLines - 1, Math.round(currentLine + pageSize))
        : Math.max(0, Math.round(currentLine - pageSize));
      this.scrollToLine(targetLine);
    }
  }

  public jumpNextPart(): void {
    const view = this.getActiveMarkdownView();
    if (!view) return;
    this.stopAutoScroll();

    if (this.settings.nextPartPageScroll) {
      this.scrollPage('down');
      return;
    }

    const currentLine = this.getCurrentScrollLine();
    const pageSize = this.getPageSizeInLines();
    const totalLines = view.editor ? view.editor.lineCount() : 1000;

    const surrounding = getSurroundingHeadings(this.rawHeadings, this.activeHeading);
    const nextHeading = surrounding.next;

    if (nextHeading) {
      const headingLine = nextHeading.position.start.line;
      const lineDist = headingLine - currentLine;

      if (lineDist > pageSize) {
        const targetLine = Math.min(totalLines - 1, Math.round(currentLine + pageSize));
        this.scrollToLine(targetLine);
      } else {
        this.jumpToSpecificHeading(nextHeading);
      }
    } else {
      const targetLine = Math.min(totalLines - 1, Math.round(currentLine + pageSize));
      this.scrollToLine(targetLine);
    }
  }

  public jumpPrevPart(): void {
    const view = this.getActiveMarkdownView();
    if (!view) return;
    this.stopAutoScroll();

    if (this.settings.nextPartPageScroll) {
      this.scrollPage('up');
      return;
    }

    const currentLine = this.getCurrentScrollLine();
    const pageSize = this.getPageSizeInLines();

    const surrounding = getSurroundingHeadings(this.rawHeadings, this.activeHeading);
    const prevHeading = surrounding.prev;

    if (prevHeading) {
      const headingLine = prevHeading.position.start.line;
      const lineDist = currentLine - headingLine;

      if (lineDist > pageSize) {
        const targetLine = Math.max(0, Math.round(currentLine - pageSize));
        this.scrollToLine(targetLine);
      } else {
        this.jumpToSpecificHeading(prevHeading);
      }
    } else {
      const targetLine = Math.max(0, Math.round(currentLine - pageSize));
      this.scrollToLine(targetLine);
    }
  }

  public jumpNextSibling(): void {
    const view = this.getActiveMarkdownView();
    if (!view || this.rawHeadings.length === 0) return;
    this.stopAutoScroll();

    if (!this.activeHeading) {
      this.jumpToSpecificHeading(this.rawHeadings[0]);
      return;
    }

    const currIdx = this.activeIndex >= 0 ? this.activeIndex : this.rawHeadings.indexOf(this.activeHeading);
    if (currIdx === -1) {
      this.jumpToSpecificHeading(this.rawHeadings[0]);
      return;
    }

    const currLevel = this.activeHeading.level;
    const mode = this.settings.deepHeadingJumpTarget || 'parent';

    // 1. For H1 and H2: jump to next heading of level <= currLevel (next H1 or H2), skipping all H3, H4, etc.
    if (currLevel <= 2) {
      let target: HeadingCache | null = null;
      for (let i = currIdx + 1; i < this.rawHeadings.length; i++) {
        const h = this.rawHeadings[i];
        if (h.level <= currLevel) {
          target = h;
          break;
        }
      }
      if (target) {
        this.jumpToSpecificHeading(target);
      }
      return;
    }

    // 2. For H3, H4, H5, H6:
    // If mode is 'parent' (default): jump to the next parent heading (level < currLevel)
    // If mode is 'sibling': jump to the next heading of level <= currLevel
    let target: HeadingCache | null = null;
    const requiredLevelThreshold = (mode === 'parent') ? (currLevel - 1) : currLevel;

    for (let i = currIdx + 1; i < this.rawHeadings.length; i++) {
      const h = this.rawHeadings[i];
      if (h.level <= requiredLevelThreshold) {
        target = h;
        break;
      }
    }

    if (target) {
      this.jumpToSpecificHeading(target);
    } else {
      // Fallback: search for any heading with level <= currLevel
      for (let i = currIdx + 1; i < this.rawHeadings.length; i++) {
        if (this.rawHeadings[i].level <= currLevel) {
          target = this.rawHeadings[i];
          break;
        }
      }
      if (target) {
        this.jumpToSpecificHeading(target);
      }
    }
  }

  public jumpPrevSibling(): void {
    const view = this.getActiveMarkdownView();
    if (!view || this.rawHeadings.length === 0) return;
    this.stopAutoScroll();

    if (!this.activeHeading) {
      this.jumpToSpecificHeading(this.rawHeadings[0]);
      return;
    }

    const currIdx = this.activeIndex >= 0 ? this.activeIndex : this.rawHeadings.indexOf(this.activeHeading);
    if (currIdx <= 0) {
      return;
    }

    const currLevel = this.activeHeading.level;
    const mode = this.settings.deepHeadingJumpTarget || 'parent';

    // 1. For H1 and H2: jump to previous heading of level <= currLevel (prev H1 or H2), skipping subheadings
    if (currLevel <= 2) {
      let target: HeadingCache | null = null;
      for (let i = currIdx - 1; i >= 0; i--) {
        const h = this.rawHeadings[i];
        if (h.level <= currLevel) {
          target = h;
          break;
        }
      }
      if (target) {
        this.jumpToSpecificHeading(target);
      }
      return;
    }

    // 2. For H3, H4, H5, H6:
    let target: HeadingCache | null = null;
    const requiredLevelThreshold = (mode === 'parent') ? (currLevel - 1) : currLevel;

    for (let i = currIdx - 1; i >= 0; i--) {
      const h = this.rawHeadings[i];
      if (h.level <= requiredLevelThreshold) {
        target = h;
        break;
      }
    }

    if (target) {
      this.jumpToSpecificHeading(target);
    } else {
      for (let i = currIdx - 1; i >= 0; i--) {
        if (this.rawHeadings[i].level <= currLevel) {
          target = this.rawHeadings[i];
          break;
        }
      }
      if (target) {
        this.jumpToSpecificHeading(target);
      }
    }
  }

  public setActiveHeadingManually(heading: HeadingCache): void {
    if (this.rawHeadings.length === 0) return;
    this.activeHeading = heading;
    const surrounding = getSurroundingHeadings(this.rawHeadings, heading);
    this.activeIndex = surrounding.activeIndex;
    this.updateHeaderDisplay(surrounding);
    this.highlightActiveInTree();
    this.calculateReadingProgress();
  }

  public getActiveHeading(): HeadingCache | null {
    return this.activeHeading;
  }

  public clear(): void {
    this.rawHeadings = [];
    this.rootNodes = [];
    this.flatNodes = [];
    this.activeHeading = null;
    this.activeIndex = -1;
    this.detachScrollListener();
    this.treeContainerEl?.empty();
    this.emptyStateEl?.show();
    this.updateHeaderDisplay(null);
    this.updateProgressBar(0);
  }

  public onunload(): void {
    BidiFlowNavigatorCore.activeInstances.delete(this);
    if (BidiFlowNavigatorCore.activeRunner === this) {
      this.stopAutoScroll();
    }
    this.detachScrollListener();
    this.clear();
  }
}
