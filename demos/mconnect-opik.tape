# MConnect Opik Observability Demo - VHS Tape
# Generate with: vhs demos/mconnect-opik.tape

Output demos/gifs/mconnect-opik.gif

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 800
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Show Opik integration
Type "# MConnect + Opik: Full Agent Observability"
Enter
Sleep 1s

Type "# Configure Opik tracing"
Enter
Type "export OPIK_API_KEY=your_api_key"
Enter
Type "export OPIK_WORKSPACE=your_workspace"
Enter
Sleep 1s

Type "npx lecoder-mconnect start"
Enter
Sleep 3s

Type "# Every agent interaction is traced:"
Enter
Sleep 1s
Type "#   → Session lifecycle traces"
Enter
Type "#   → Agent spawn/exit events"
Enter
Type "#   → Command execution spans"
Enter
Type "#   → Security guardrail checks"
Enter
Type "#   → LLM-as-Judge metrics"
Enter
Sleep 2s

Type "# 4 Custom Evaluation Metrics:"
Enter
Type "#   1. CommandSafetyMetric"
Enter
Type "#   2. AgentToolSelectionMetric"
Enter
Type "#   3. SessionHealthMetric"
Enter
Type "#   4. AgentCoordinationMetric"
Enter
Sleep 3s

Type "# View in Opik Dashboard →"
Enter
Type "open https://www.comet.com/opik"
Enter
Sleep 3s
