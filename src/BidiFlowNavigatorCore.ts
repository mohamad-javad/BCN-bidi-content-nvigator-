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
import { getActiveHeading, getSurroundingHeadings, scrollToHeading } from './scrollSpy';
import { t } from './i18n';

export class BidiFlowNavigatorCore extends Component {
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
    this.buildSkeleton();
    this.registerDomEvents();
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
  }

  private registerDomEvents(): void {
    // Navigation jumps
    this.prevBtnEl.addEventListener('click', () => this.jumpSection('prev'));
    this.nextBtnEl.addEventListener('click', () => this.jumpSection('next'));

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
          if (this.currentView) {
            this.isUserInteractingWithTree = false;
            // Instantly update active heading, UI badge, tree highlight, and progress bar
            this.activeHeading = node.heading;
            this.onActiveHeadingChange?.(node.heading);
            const surrounding = getSurroundingHeadings(this.rawHeadings, node.heading);
            this.activeIndex = surrounding.activeIndex;
            this.updateHeaderDisplay(surrounding);
            this.highlightActiveInTree();
            this.calculateReadingProgress();

            scrollToHeading(this.currentView, node.heading, 'smooth');
            if (this.currentView.getMode() !== 'preview') {
              this.currentView.editor?.focus();
            }
          }
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

    const previewContainer = this.currentView.previewMode?.containerEl;
    if (previewContainer) {
      previewContainer.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => previewContainer.removeEventListener('scroll', onScroll));
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
    const mode = this.currentView.getMode();

    if (mode === 'preview') {
      const container = this.currentView.previewMode?.containerEl;
      if (container) {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll > 10) {
          if (container.scrollTop <= 5) {
            percent = 0;
          } else if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
            percent = 100;
          } else {
            percent = Math.round((container.scrollTop / maxScroll) * 100);
          }
        }
      }
    } else {
      const scroller = this.currentView.contentEl.querySelector<HTMLElement>('.cm-scroller');
      if (scroller) {
        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        if (maxScroll > 10) {
          if (scroller.scrollTop <= 5) {
            percent = 0;
          } else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 15) {
            percent = 100;
          } else {
            percent = Math.round((scroller.scrollTop / maxScroll) * 100);
          }
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
    this.detachScrollListener();
    this.clear();
  }
}
