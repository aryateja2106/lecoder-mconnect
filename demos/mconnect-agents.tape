# MConnect Multi-Agent Demo - VHS Tape
# Generate with: vhs demos/mconnect-agents.tape

Output demos/gifs/mconnect-agents.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Show MConnect with multiple agents
Type "# MConnect Multi-Agent Control"
Enter
Sleep 1s

Type "npx lecoder-mconnect start --agents claude-code,cursor,gemini"
Enter
Sleep 4s

# Show tmux windows
Type "# Switch between agents with tmux"
Enter
Sleep 1s

# Simulate tmux operations
Type "tmux list-windows -t mconnect"
Enter
Sleep 2s

Type "# Agent 1: Claude Code - coding agent"
Enter
Type "# Agent 2: Cursor - AI pair programmer"
Enter
Type "# Agent 3: Gemini CLI - research agent"
Enter
Sleep 2s

Type "# Control all from your phone 📱"
Enter
Sleep 3s
