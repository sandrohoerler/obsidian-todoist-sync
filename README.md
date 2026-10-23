# Todoist One-Way Sync for Obsidian
The only Obsidian -> Todoist Task sync without 2way sync. I was searching for such a simple plugin, as i couldn't find it, i created it.
Works like a charm due to the simplicity of this plugin. Sync gets triggered when a note is saved. All Tasks with a trailing `#todoist` tag on the same line will create a Task in Todoist in the Inbox Project (per default).

Pushes Markdown checkbox tasks from Obsidian to Todoist. It never imports Todoist data and never modifies a note based on Todoist.

## Install
1. Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/todoist-one-way/`.
2. In Obsidian, enable **Community plugins**, then enable **Todoist One-Way Sync**.
3. Open the plugin settings and add the Todoist API token from Todoist **Settings → Integrations → Developer**.

## Usage
```markdown
- [ ] Finish PEMA documentation #todoist
```

Run **Todoist One-Way Sync: Push tasks to Todoist now**, or enable sync on save. After creation, the line becomes:

```markdown
- [ ] Finish PEMA documentation #todoist <!-- todoist-id:... -->
```

Editing the text updates Todoist. Checking or unchecking the box closes or reopens Todoist. Changes made directly in Todoist are deliberately ignored and will be overwritten by the next Obsidian push.

## Important limitations
- Do not remove or manually edit the `todoist-id` marker unless you intend to create a second task.
- Deleting an Obsidian task does not delete the Todoist task.
- Due dates, priorities, labels, subtasks, projects per task, and conflict detection are not implemented in this MVP.
- The token is stored in the plugin's `data.json`; exclude `.obsidian/plugins/todoist-one-way/data.json` from vault synchronization if necessary.
