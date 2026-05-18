import re

with open('packages/server/src/mcp/MCPBridge.ts', 'r') as f:
    content = f.read()

content = content.replace("traceContext?: TraceContext;", "span?: import('@opentelemetry/api').Span;")
content = content.replace("traceContext: traceCtx,", "span,")
content = re.sub(r"^\s*e;\s*$", "", content, flags=re.MULTILINE)

with open('packages/server/src/mcp/MCPBridge.ts', 'w') as f:
    f.write(content)
