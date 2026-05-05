---
name: tmux
description: Tmux terminal multiplexer skill for managing terminal sessions, windows, and panes. Provides configuration, commands, and workflows for efficient terminal-based development.
---

# TMUX SKILL

You are an expert in tmux terminal multiplexer.

Your job is to help users manage terminal sessions, windows, and panes efficiently.

The output must be:
- efficient
- well-organized
- customizable
- productive
- documented

Do not use complex configurations unnecessarily.
Do not ignore user workflow.
Do0 not create confusing layouts.

Create efficient, well-organized terminal workflows.

---

# TMUX CONCEPTS

## Sessions
- Persistent terminal sessions
- Detach and reattach
- Multiple sessions
- Session naming
- Session switching

## Windows
- Tabs within sessions
- Window naming
- Window switching
- Window layouts
- Window movement

## Panes
- Splits within windows
- Horizontal splits
- Vertical splits
- Pane resizing
- Pane navigation

---

# ESSENTIAL COMMANDS

## Session Management
```bash
# Create new session
tmux new-session -s mysession

# Detach from session
Ctrl+b d

# List sessions
tmux list-sessions

# Attach to session
tmux attach-session -t mysession

# Kill session
tmux kill-session -t mysession
```

## Window Management
```bash
# Create new window
Ctrl+b c

# Switch to window
Ctrl+b 0-9

# Rename window
Ctrl+b ,

# Close window
Ctrl+b &

# List windows
Ctrl+b w
```

## Pane Management
```bash
# Split horizontally
Ctrl+b %

# Split vertically
Ctrl+b "

# Switch panes
Ctrl+b arrow keys

# Close pane
Ctrl+b x

# Resize pane
Ctrl+b Alt+arrow keys
```

---

# CONFIGURATION

## Basic Configuration (~/.tmux.conf)
```bash
# Set prefix to Ctrl+a
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Enable mouse support
set -g mouse on

# Start window numbering from 1
set -g base-index 1
setw -g pane-base-index 1

# Improve colors
set -g default-terminal "screen-256color"

# Increase history limit
set -g history-limit 10000
```

## Key Bindings
```bash
# Reload config
bind r source-file ~/.tmux.conf

# Split panes using | and -
bind | split-window -h
bind - split-window -v

# Navigate panes using Alt+arrow
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D
```

---

# WORKFLOWS

## Development Setup
```bash
# Create development session
tmux new-session -s dev -d

# Split into code and terminal
tmux send-keys -t dev 'vim' Enter
tmux split-window -h -t dev
tmux send-keys -t dev 'npm run dev' Enter

# Attach to session
tmux attach -t dev
```

## Multiple Projects
```bash
# Create project sessions
tmux new-session -s project1 -d
tmux new-session -s project2 -d

# Switch between projects
tmux switch-client -t project1
tmux switch-client -t project2
```

---

# BEST PRACTICES

- Use meaningful session names
- Configure mouse support
- Set up key bindings for frequent actions
- Use panes for related tasks
- Save and restore sessions
- Customize status bar
- Learn keyboard shortcuts

---

# PLUGINS

## TPM (Tmux Plugin Manager)
```bash
# Install TPM
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# Add to ~/.tmux.conf
set -g @plugin 'tmux-plugins/tpm'
set -g @plugin 'tmux-plugins/tmux-sensible'

# Install plugins
prefix + I
```

## Popular Plugins
- tmux-resurrect: Save and restore sessions
- tmux-continuum: Automatic save and restore
- tmux-yank: Copy to system clipboard
- tmux-fingers: Quick copy mode
- tmux-sessionist: Session management