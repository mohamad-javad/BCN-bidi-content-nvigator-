import { App, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type BidiFlowNavigatorPlugin from './main';
import { t } from './i18n';
import { NavigatorDisplayMode, BidiColorTheme, BidiThemeStyle } from './types';

export class BidiFlowSettingTab extends PluginSettingTab {
  private plugin: BidiFlowNavigatorPlugin;

  constructor(app: App, plugin: BidiFlowNavigatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public override getSettingDefinitions(): SettingDefinitionItem[] {
    const tr = t(this.plugin.settings.uiLanguage);

    return [
      {
        name: tr.langSettingName,
        desc: tr.langSettingDesc,
        control: {
          type: 'dropdown',
          key: 'uiLanguage',
          options: {
            fa: tr.langFa,
            en: tr.langEn,
          },
        },
      },
      {
        name: tr.showFloatingName,
        desc: tr.showFloatingDesc,
        control: {
          type: 'toggle',
          key: 'showFloatingWidget',
        },
      },
      {
        name: tr.floatingPosName,
        desc: tr.floatingPosDesc,
        control: {
          type: 'dropdown',
          key: 'floatingPosition',
          options: {
            right: tr.posRight,
            left: tr.posLeft,
          },
        },
      },
      {
        name: tr.defaultModeName,
        desc: tr.defaultModeDesc,
        control: {
          type: 'dropdown',
          key: 'defaultMode',
          options: {
            floating: tr.modeFloating,
            mini: tr.modeMini,
            'full-height': tr.modeFullHeight,
          },
        },
      },
      {
        name: tr.widgetWidthName,
        desc: tr.widgetWidthDesc,
        control: {
          type: 'slider',
          key: 'widgetWidth',
          min: 200,
          max: 420,
          step: 10,
        },
      },
      {
        name: tr.persianNumeralsName,
        desc: tr.persianNumeralsDesc,
        control: {
          type: 'toggle',
          key: 'persianNumerals',
        },
      },
      {
        name: tr.progressBarName,
        desc: tr.progressBarDesc,
        control: {
          type: 'toggle',
          key: 'showProgressBar',
        },
      },
      {
        name: tr.searchName,
        desc: tr.searchDesc,
        control: {
          type: 'toggle',
          key: 'showSearch',
        },
      },
      {
        name: tr.levelBadgeName,
        desc: tr.levelBadgeDesc,
        control: {
          type: 'toggle',
          key: 'showLevelBadge',
        },
      },
      {
        name: tr.indentStepName,
        desc: tr.indentStepDesc,
        control: {
          type: 'slider',
          key: 'indentStepPx',
          min: 6,
          max: 24,
          step: 2,
        },
      },
      {
        name: tr.maxLevelName,
        desc: tr.maxLevelDesc,
        control: {
          type: 'dropdown',
          key: 'maxHeadingLevel',
          options: {
            '1': tr.h1Only,
            '2': tr.upToLevel(2),
            '3': tr.upToLevel(3),
            '4': tr.upToLevel(4),
            '5': tr.upToLevel(5),
            '6': tr.allLevels,
          },
        },
      },
      {
        name: tr.colorThemeName,
        desc: tr.colorThemeDesc,
        control: {
          type: 'dropdown',
          key: 'colorTheme',
          options: {
            default: tr.themeDefault,
            nord: tr.themeNord,
            dracula: tr.themeDracula,
            catppuccin: tr.themeCatppuccin,
            gruvbox: tr.themeGruvbox,
            'tokyo-night': tr.themeTokyoNight,
            solarized: tr.themeSolarized,
          },
        },
      },
      {
        name: tr.themeStyleName,
        desc: tr.themeStyleDesc,
        control: {
          type: 'dropdown',
          key: 'themeStyle',
          options: {
            solid: tr.themeStyleSolid,
            transparent: tr.themeStyleTransparent,
          },
        },
      },
      {
        name: tr.rememberLastHeadingName,
        desc: tr.rememberLastHeadingDesc,
        control: {
          type: 'toggle',
          key: 'rememberLastHeading',
        },
      },
      {
        name: tr.bottomToolbarName,
        desc: tr.bottomToolbarDesc,
        control: {
          type: 'toggle',
          key: 'showBottomToolbar',
        },
      },
      {
        name: tr.autoScrollSpeedName,
        desc: tr.autoScrollSpeedDesc,
        control: {
          type: 'slider',
          key: 'autoScrollSpeed',
          min: 10,
          max: 120,
          step: 5,
        },
      },
      {
        name: tr.showAutoScrollBtnName,
        desc: tr.showAutoScrollBtnDesc,
        control: {
          type: 'toggle',
          key: 'showAutoScrollBtn',
        },
      },
      {
        name: tr.showNextPartBtnName,
        desc: tr.showNextPartBtnDesc,
        control: {
          type: 'toggle',
          key: 'showNextPartBtn',
        },
      },
      {
        name: tr.showNextSiblingBtnName,
        desc: tr.showNextSiblingBtnDesc,
        control: {
          type: 'toggle',
          key: 'showNextSiblingBtn',
        },
      },
    ];
  }

  public override getControlValue(key: string): unknown {
    if (key === 'maxHeadingLevel') {
      return String(this.plugin.settings.maxHeadingLevel);
    }
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  public override async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'maxHeadingLevel') {
      this.plugin.settings.maxHeadingLevel = parseInt(value as string, 10);
    } else {
      (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    }
    await this.plugin.saveSettings();
    this.plugin.refreshAllWidgets();
    if (key === 'uiLanguage') {
      this.renderSettings();
    }
  }

  public display(): void {
    this.renderSettings();
  }

  private renderSettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    const tr = t(this.plugin.settings.uiLanguage);

    new Setting(containerEl).setName(tr.settingsTitle).setHeading();

    // Language Selection
    new Setting(containerEl)
      .setName(tr.langSettingName)
      .setDesc(tr.langSettingDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('fa', tr.langFa)
          .addOption('en', tr.langEn)
          .setValue(this.plugin.settings.uiLanguage)
          .onChange(async (val: string) => {
            this.plugin.settings.uiLanguage = val as 'fa' | 'en';
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
            this.renderSettings();
          })
      );

    // Floating Widget Toggle
    new Setting(containerEl)
      .setName(tr.showFloatingName)
      .setDesc(tr.showFloatingDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showFloatingWidget)
          .onChange(async (val) => {
            this.plugin.settings.showFloatingWidget = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Floating Position
    new Setting(containerEl)
      .setName(tr.floatingPosName)
      .setDesc(tr.floatingPosDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('right', tr.posRight)
          .addOption('left', tr.posLeft)
          .setValue(this.plugin.settings.floatingPosition)
          .onChange(async (val: string) => {
            this.plugin.settings.floatingPosition = val as 'right' | 'left';
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Default Window Mode (3-Mode)
    new Setting(containerEl)
      .setName(tr.defaultModeName)
      .setDesc(tr.defaultModeDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('floating', tr.modeFloating)
          .addOption('mini', tr.modeMini)
          .addOption('full-height', tr.modeFullHeight)
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (val: string) => {
            this.plugin.settings.defaultMode = val as NavigatorDisplayMode;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Widget Width
    new Setting(containerEl)
      .setName(tr.widgetWidthName)
      .setDesc(tr.widgetWidthDesc)
      .addSlider((slider) =>
        slider
          .setLimits(200, 420, 10)
          .setValue(this.plugin.settings.widgetWidth)
          .onChange(async (val) => {
            this.plugin.settings.widgetWidth = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Persian Digits Toggle
    new Setting(containerEl)
      .setName(tr.persianNumeralsName)
      .setDesc(tr.persianNumeralsDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.persianNumerals)
          .onChange(async (val) => {
            this.plugin.settings.persianNumerals = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Progress Bar Toggle
    new Setting(containerEl)
      .setName(tr.progressBarName)
      .setDesc(tr.progressBarDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showProgressBar)
          .onChange(async (val) => {
            this.plugin.settings.showProgressBar = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Search Box Toggle
    new Setting(containerEl)
      .setName(tr.searchName)
      .setDesc(tr.searchDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSearch)
          .onChange(async (val) => {
            this.plugin.settings.showSearch = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Level Badge Toggle
    new Setting(containerEl)
      .setName(tr.levelBadgeName)
      .setDesc(tr.levelBadgeDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showLevelBadge)
          .onChange(async (val) => {
            this.plugin.settings.showLevelBadge = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Indent Step Slider
    new Setting(containerEl)
      .setName(tr.indentStepName)
      .setDesc(tr.indentStepDesc)
      .addSlider((slider) =>
        slider
          .setLimits(6, 24, 2)
          .setValue(this.plugin.settings.indentStepPx)
          .onChange(async (val) => {
            this.plugin.settings.indentStepPx = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Max Heading Level
    new Setting(containerEl)
      .setName(tr.maxLevelName)
      .setDesc(tr.maxLevelDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('1', tr.h1Only)
          .addOption('2', tr.upToLevel(2))
          .addOption('3', tr.upToLevel(3))
          .addOption('4', tr.upToLevel(4))
          .addOption('5', tr.upToLevel(5))
          .addOption('6', tr.allLevels)
          .setValue(String(this.plugin.settings.maxHeadingLevel))
          .onChange(async (val) => {
            this.plugin.settings.maxHeadingLevel = parseInt(val, 10);
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Color Theme Dropdown
    new Setting(containerEl)
      .setName(tr.colorThemeName)
      .setDesc(tr.colorThemeDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('default', tr.themeDefault)
          .addOption('nord', tr.themeNord)
          .addOption('dracula', tr.themeDracula)
          .addOption('catppuccin', tr.themeCatppuccin)
          .addOption('gruvbox', tr.themeGruvbox)
          .addOption('tokyo-night', tr.themeTokyoNight)
          .addOption('solarized', tr.themeSolarized)
          .setValue(this.plugin.settings.colorTheme || 'default')
          .onChange(async (val) => {
            this.plugin.settings.colorTheme = val as BidiColorTheme;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Theme Style (Solid vs Transparent Glass)
    new Setting(containerEl)
      .setName(tr.themeStyleName)
      .setDesc(tr.themeStyleDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption('solid', tr.themeStyleSolid)
          .addOption('transparent', tr.themeStyleTransparent)
          .setValue(this.plugin.settings.themeStyle || 'solid')
          .onChange(async (val) => {
            this.plugin.settings.themeStyle = val as BidiThemeStyle;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Remember Last Heading Position
    new Setting(containerEl)
      .setName(tr.rememberLastHeadingName)
      .setDesc(tr.rememberLastHeadingDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.rememberLastHeading)
          .onChange(async (val) => {
            this.plugin.settings.rememberLastHeading = val;
            await this.plugin.saveSettings();
          })
      );

    // Bottom Action Toolbar Toggle
    new Setting(containerEl)
      .setName(tr.bottomToolbarName)
      .setDesc(tr.bottomToolbarDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showBottomToolbar)
          .onChange(async (val) => {
            this.plugin.settings.showBottomToolbar = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Auto Scroll Speed Slider
    new Setting(containerEl)
      .setName(tr.autoScrollSpeedName)
      .setDesc(tr.autoScrollSpeedDesc)
      .addSlider((slider) =>
        slider
          .setLimits(10, 120, 5)
          .setValue(this.plugin.settings.autoScrollSpeed)
          .onChange(async (val) => {
            this.plugin.settings.autoScrollSpeed = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Show Auto Scroll Button Toggle
    new Setting(containerEl)
      .setName(tr.showAutoScrollBtnName)
      .setDesc(tr.showAutoScrollBtnDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showAutoScrollBtn)
          .onChange(async (val) => {
            this.plugin.settings.showAutoScrollBtn = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Show Next Part Button Toggle
    new Setting(containerEl)
      .setName(tr.showNextPartBtnName)
      .setDesc(tr.showNextPartBtnDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showNextPartBtn)
          .onChange(async (val) => {
            this.plugin.settings.showNextPartBtn = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );

    // Show Next Sibling Button Toggle
    new Setting(containerEl)
      .setName(tr.showNextSiblingBtnName)
      .setDesc(tr.showNextSiblingBtnDesc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showNextSiblingBtn)
          .onChange(async (val) => {
            this.plugin.settings.showNextSiblingBtn = val;
            await this.plugin.saveSettings();
            this.plugin.refreshAllWidgets();
          })
      );
  }
}
