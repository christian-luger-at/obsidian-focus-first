import { App, PluginSettingTab, Setting } from 'obsidian';
import EisenhowerPlugin from './main';

export interface EisenhowerSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: EisenhowerSettings = {
	mySetting: 'default',
};

export class EisenhowerSettingTab extends PluginSettingTab {
	plugin: EisenhowerPlugin;

	constructor(app: App, plugin: EisenhowerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder('Enter your secret')
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
