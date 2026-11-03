const { Plugin, PluginSettingTab, Setting, Notice, requestUrl } = require('obsidian');

const DEFAULTS = { token: '', tag: '#todoist', projectId: '', syncOnSave: true };
const ID_RE = /<!--\s*todoist-id:([^\s>]+)\s*-->/;
const TASK_RE = /^(\s*)- \[([ xX])\] (.*)$/;

function findLineIndex(lines, edit, used) {
  if (edit.index < lines.length && !used.has(edit.index) && lines[edit.index] === edit.from) return edit.index;
  for (let i = 0; i < lines.length; i++) {
    if (!used.has(i) && lines[i] === edit.from) return i;
  }
  return -1;
}

function applyLineEdits(data, edits) {
  const lines = data.split('\n');
  const used = new Set();
  let changed = false;
  for (const edit of edits) {
    const idx = findLineIndex(lines, edit, used);
    if (idx === -1 || ID_RE.test(lines[idx])) continue;
    lines[idx] = edit.to;
    used.add(idx);
    changed = true;
  }
  return changed ? lines.join('\n') : data;
}

module.exports = class TodoistOneWayPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());
    this.timer = null;
    this.syncListener = null;
    this.addSettingTab(new SettingsTab(this.app, this));
    this.setSyncListener(this.settings.syncOnSave);
  }
  onunload() {
    this.setSyncListener(false);
  }
  setSyncListener(enabled) {
    if (this.syncListener) {
      this.app.vault.offref(this.syncListener);
      this.syncListener = null;
    }
    if (!enabled) {
      clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    this.syncListener = this.app.vault.on('modify', (file) => {
      if (file.extension === 'md') this.queueFile(file);
    });
  }
  queueFile(file) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncFile(file).catch(e => this.fail(e)), 1000);
  }
  editorFor(file) {
    const active = this.app.workspace.activeEditor;
    if (!active || !active.editor || !active.file) return null;
    if (active.file.path !== file.path) return null;
    return active.editor;
  }
  async syncFile(file) {
    if (!this.settings.token) return 0;
    const editor = this.editorFor(file);
    const original = editor ? editor.getValue() : await this.app.vault.read(file);
    const lines = original.split('\n');
    const edits = [];
    let changes = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(TASK_RE);
      if (!m || !m[3].includes(this.settings.tag)) continue;
      const completed = m[2].toLowerCase() === 'x';
      const idMatch = m[3].match(ID_RE);
      const content = this.cleanContent(m[3]);
      try {
        if (!idMatch) {
          if (completed) continue;
          const task = await this.api('POST', '/tasks', { content, ...(this.settings.projectId ? { project_id: this.settings.projectId } : {}) });
          edits.push({ index: i, from: lines[i], to: lines[i] + ` <!-- todoist-id:${task.id} -->` });
          changes++;
        } else {
          const id = idMatch[1];
          await this.api('POST', `/tasks/${id}`, { content });
          await this.api('POST', `/tasks/${id}/${completed ? 'close' : 'reopen'}`);
          changes++;
        }
      } catch (e) { console.error(`Todoist sync failed in ${file.path}:${i + 1}`, e); }
    }
    if (edits.length) await this.applyEdits(file, edits);
    return changes;
  }
  async applyEdits(file, edits) {
    const editor = this.editorFor(file);
    if (editor) {
      this.applyEditorEdits(editor, edits);
      return;
    }
    await this.app.vault.process(file, (data) => applyLineEdits(data, edits));
  }
  applyEditorEdits(editor, edits) {
    const lines = [];
    for (let i = 0; i < editor.lineCount(); i++) lines.push(editor.getLine(i));
    const used = new Set();
    for (const edit of edits) {
      const idx = findLineIndex(lines, edit, used);
      if (idx === -1 || ID_RE.test(lines[idx])) continue;
      editor.setLine(idx, edit.to);
      lines[idx] = edit.to;
      used.add(idx);
    }
  }
  cleanContent(s) {
    return s.replace(ID_RE, '').replace(this.settings.tag, '').trim();
  }
  async api(method, path, body) {
    const r = await requestUrl({
      url: `https://api.todoist.com/api/v1${path}`, method,
      headers: { Authorization: `Bearer ${this.settings.token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined, throw: false
    });
    if (r.status < 200 || r.status >= 300) throw new Error(`${method} ${path}: ${r.status} ${r.text}`);
    return r.text ? r.json : {};
  }
  fail(e) { console.error(e); new Notice(`Todoist One-Way Sync failed: ${e.message || e}`); }
  async saveSettings() { await this.saveData(this.settings); }
};

class SettingsTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('p', { text: 'Obsidian is the source of truth. This plugin never reads tasks from Todoist.' });
    new Setting(containerEl).setName('Todoist API token').setDesc('Stored in this plugin’s local data.json. Treat it like a password.')
      .addText(t => t.setPlaceholder('API token').setValue(this.plugin.settings.token).onChange(async v => { this.plugin.settings.token = v.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('Sync tag').setDesc('Only Markdown tasks containing this tag are pushed.')
      .addText(t => t.setValue(this.plugin.settings.tag).onChange(async v => { this.plugin.settings.tag = v.trim() || '#todoist'; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('Default Todoist project ID').setDesc('Optional. Leave empty for the Todoist Inbox.')
      .addText(t => t.setValue(this.plugin.settings.projectId).onChange(async v => { this.plugin.settings.projectId = v.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName('Sync when a note is saved').addToggle(t => t.setValue(this.plugin.settings.syncOnSave).onChange(async v => {
      this.plugin.settings.syncOnSave = v;
      await this.plugin.saveSettings();
      this.plugin.setSyncListener(v);
    }));
  }
}
