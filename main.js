const { Plugin, PluginSettingTab, Setting, Notice, requestUrl } = require('obsidian');

const DEFAULTS = { token: '', tag: '#todoist', projectId: '', syncOnSave: true };
const ID_RE = /<!--\s*todoist-id:([^\s>]+)\s*-->/;
const TASK_RE = /^(\s*)- \[([ xX])\] (.*)$/;

module.exports = class TodoistOneWayPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.addSettingTab(new SettingsTab(this.app, this));
    this.addCommand({ id:'sync-now', name:'Push tasks to Todoist now', callback:()=>this.syncAll(true) });
    this.addRibbonIcon('send', 'Push tasks to Todoist', ()=>this.syncAll(true));
    if (this.settings.syncOnSave) this.registerEvent(this.app.vault.on('modify', f => {
      if (f.extension === 'md') this.queueFile(f);
    }));
  }
  queueFile(file) {
    clearTimeout(this.timer);
    this.timer = setTimeout(()=>this.syncFile(file).catch(e=>this.fail(e)), 1000);
  }
  async syncAll(showNotice=false) {
    if (!this.settings.token) return new Notice('Todoist One-Way Sync: add your API token first.');
    let count=0;
    for (const file of this.app.vault.getMarkdownFiles()) count += await this.syncFile(file);
    if (showNotice) new Notice(`Todoist One-Way Sync: pushed ${count} change(s).`);
  }
  async syncFile(file) {
    if (!this.settings.token) return 0;
    const original = await this.app.vault.read(file);
    const lines = original.split('\n');
    let changes=0, localChanged=false;
    for (let i=0; i<lines.length; i++) {
      const m=lines[i].match(TASK_RE);
      if (!m || !m[3].includes(this.settings.tag)) continue;
      const completed = m[2].toLowerCase()==='x';
      const idMatch=m[3].match(ID_RE);
      const content=this.cleanContent(m[3]);
      try {
        if (!idMatch) {
          if (completed) continue;
          const task=await this.api('POST','/tasks',{content, ...(this.settings.projectId?{project_id:this.settings.projectId}:{})});
          lines[i] += ` <!-- todoist-id:${task.id} -->`;
          localChanged=true; changes++;
        } else {
          const id=idMatch[1];
          await this.api('POST',`/tasks/${id}`,{content});
          await this.api('POST',`/tasks/${id}/${completed?'close':'reopen'}`);
          changes++;
        }
      } catch(e) { console.error(`Todoist sync failed in ${file.path}:${i+1}`,e); }
    }
    if (localChanged) await this.app.vault.modify(file,lines.join('\n'));
    return changes;
  }
  cleanContent(s) {
    return s.replace(ID_RE,'').replace(this.settings.tag,'').trim();
  }
  async api(method,path,body) {
    const r=await requestUrl({url:`https://api.todoist.com/api/v1${path}`,method,
      headers:{Authorization:`Bearer ${this.settings.token}`,'Content-Type':'application/json'},
      body: body ? JSON.stringify(body) : undefined, throw:false});
    if (r.status < 200 || r.status >= 300) throw new Error(`${method} ${path}: ${r.status} ${r.text}`);
    return r.text ? r.json : {};
  }
  fail(e){ console.error(e); new Notice(`Todoist One-Way Sync failed: ${e.message||e}`); }
  async saveSettings(){ await this.saveData(this.settings); }
};

class SettingsTab extends PluginSettingTab {
  constructor(app,plugin){ super(app,plugin); this.plugin=plugin; }
  display(){ const {containerEl}=this; containerEl.empty();
    containerEl.createEl('h2',{text:'Todoist One-Way Sync'});
    containerEl.createEl('p',{text:'Obsidian is the source of truth. This plugin never reads tasks from Todoist.'});
    new Setting(containerEl).setName('Todoist API token').setDesc('Stored in this plugin’s local data.json. Treat it like a password.')
      .addText(t=>t.setPlaceholder('API token').setValue(this.plugin.settings.token).onChange(async v=>{this.plugin.settings.token=v.trim();await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('Sync tag').setDesc('Only Markdown tasks containing this tag are pushed.')
      .addText(t=>t.setValue(this.plugin.settings.tag).onChange(async v=>{this.plugin.settings.tag=v.trim()||'#todoist';await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('Default Todoist project ID').setDesc('Optional. Leave empty for the Todoist Inbox.')
      .addText(t=>t.setValue(this.plugin.settings.projectId).onChange(async v=>{this.plugin.settings.projectId=v.trim();await this.plugin.saveSettings();}));
    new Setting(containerEl).setName('Sync when a note is saved').addToggle(t=>t.setValue(this.plugin.settings.syncOnSave).onChange(async v=>{this.plugin.settings.syncOnSave=v;await this.plugin.saveSettings();}));
  }
}
