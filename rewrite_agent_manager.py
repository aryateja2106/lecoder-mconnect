import re

with open('packages/server/src/agents/AgentManager.ts', 'r') as f:
    content = f.read()

# Replace imports
content = content.replace(
    "import { getOpikService, type TraceContext } from '../observability/OpikService.js';",
    "import { Span } from '@opentelemetry/api';\nimport { tracer } from '../observability/telemetry.js';"
)

content = content.replace("traceContext?: TraceContext;", "traceContext?: Span;")

# Replace opik usages
content = content.replace("const opik = getOpikService();", "")

# startTrace
content = re.sub(
    r"const traceCtx = opik\.startTrace\('([^']+)', \{(.*?)\}\);",
    r"const traceCtx = tracer.startSpan('\1');\ntraceCtx.setAttributes({\2});",
    content,
    flags=re.DOTALL
)

# traceCtx.userId = sessionCtx.userId; => traceCtx.setAttribute('userId', sessionCtx.userId);
content = re.sub(
    r"traceCtx\.userId = ([^;]+);",
    r"traceCtx.setAttribute('userId', \1);",
    content
)
content = re.sub(
    r"traceCtx\.sessionId = ([^;]+);",
    r"traceCtx.setAttribute('sessionId', \1);",
    content
)

# startSpan
content = re.sub(
    r"const ([a-zA-Z0-9_]+) = opik\.startSpan\([^,]+, '([^']+)', 'general', \{(.*?)\}\);",
    r"const \1 = tracer.startSpan('\2');\n\1.setAttributes({\3});",
    content,
    flags=re.DOTALL
)

# endSpan
content = re.sub(
    r"opik\.endSpan\(([a-zA-Z0-9_]+), \{(.*?)\}\);",
    r"\1.setAttributes({\2});\n\1.end();",
    content,
    flags=re.DOTALL
)

# endTrace success
content = re.sub(
    r"opik\.endTrace\(([a-zA-Z0-9_]+), \{(.*?)\}\);",
    r"\1.setAttributes({\2});\n\1.end();",
    content,
    flags=re.DOTALL
)

# endTrace error
content = re.sub(
    r"opik\.endTrace\(([a-zA-Z0-9_]+), undefined, (.*?)\);",
    r"\1.recordException(\2);\n\1.end();",
    content,
    flags=re.DOTALL
)

with open('packages/server/src/agents/AgentManager.ts', 'w') as f:
    f.write(content)

print("AgentManager.ts rewritten.")
