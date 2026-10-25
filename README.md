# Todoist One-Way Sync for Obsidian

A lightweight Obsidian plugin that pushes Markdown checkbox tasks to Todoist. It is designed as a one-way sync: Obsidian is the source of truth, and Todoist receives new or updated tasks without importing data back into your notes.

The plugin watches for changes when a note is saved and sends any task line ending with `#todoist` to your Todoist account. It never creates a two-way sync and it does not rewrite notes based on Todoist changes.

## Features

- Pushes Markdown checkbox tasks from Obsidian to Todoist
- Triggers sync automatically when a note is saved
- Supports manual pushes from the command palette
- Tracks tasks using a `todoist-id` marker in the note
- Keeps Todoist and Obsidian updates intentionally one-way

## Installation

1. Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/todoist-one-way/`.
2. In Obsidian, enable Community plugins, then enable `Todoist One-Way Sync`.
3. Open the plugin settings and add your Todoist API token from Todoist: `Settings → Integrations → Developer`.

## Usage

Create a task like this in a note:

```markdown
- [ ] Finish PEMA documentation #todoist
```

Then run the command `Todoist One-Way Sync: Push tasks to Todoist now`, or enable sync-on-save. After the task is created in Todoist, the line is updated to include the Todoist task reference:

```markdown
- [ ] Finish PEMA documentation #todoist <!-- todoist-id:123456789 -->
```

The plugin updates the matching Todoist task when the note changes. Checking or unchecking the checkbox in Obsidian will close or reopen the equivalent task in Todoist. Changes made directly in Todoist are intentionally ignored and will be overwritten by the next Obsidian sync.

## Important limitations

- Do not remove or manually edit the `todoist-id` marker unless you intend to create a second task.
- Deleting an Obsidian task does not delete the Todoist task.
- Due dates, priorities, labels, subtasks, project assignment per task, and conflict detection are not implemented in this MVP.
- The token is stored in the plugin's `data.json`. If necessary, exclude `.obsidian/plugins/todoist-one-way/data.json` from vault synchronization.

## License

This project is distributed under the terms of the MIT license.
