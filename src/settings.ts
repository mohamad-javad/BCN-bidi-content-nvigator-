import { App, PluginSettingTab, Setting } from 'obsidian';
import type BidiFlowNavigatorPlugin from './main';
import { t } from './i18n';
import { NavigatorDisplayMode } from './types';

export class BidiFlowSettingTab extends PluginSettingTab {
  private plugin: BidiFlowNavigatorPlugin;

  constructor(app: App, plugin: BidiFlowNavigatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  public display(): void {
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
            this.display();
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
  }
}
