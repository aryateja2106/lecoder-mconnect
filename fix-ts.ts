import { Project, SyntaxKind } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "packages/cli/tsconfig.json",
});

const files = [
  "src/agents/agent-manager.ts",
  "src/container/container-manager.ts",
  "src/guardrails.ts",
  "src/input/InputArbiter.ts",
  "src/session.ts",
  "src/ws/ws-hub.ts"
];

for (const filePath of files) {
  const sourceFile = project.getSourceFileOrThrow(`packages/cli/${filePath}`);
  
  // Remove imports for Opik/Observability
  sourceFile.getImportDeclarations().forEach(imp => {
    const text = imp.getModuleSpecifierValue();
    if (text.includes("opik") || text.includes("observability")) {
      imp.remove();
    }
  });

  // Find all function calls to getOpikTracer().xyz() and remove the statement
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const text = expr.getText();
      if (text.startsWith("getOpikTracer()") || text.startsWith("this.opikTracer") || text.startsWith("observability.")) {
        const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        if (stmt) {
           try { stmt.remove(); } catch (e) {}
        }
      }
    }
  });

  // Find occurrences of getObservability()
  sourceFile.getVariableDeclarations().forEach(dec => {
    const init = dec.getInitializer();
    if (init && init.getText() === "getObservability()") {
      const stmt = dec.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      if (stmt) {
          try { stmt.remove(); } catch (e) {}
      }
    }
  });

  // Find references to `obs.` and remove them
  sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).forEach(access => {
    if (access.getExpression().getText() === "obs") {
      const stmt = access.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
      if (stmt) {
        try { stmt.remove(); } catch (e) {}
      }
    }
  });

  // Find variables assigned to getOpikTracer()
  sourceFile.getVariableDeclarations().forEach(dec => {
    const init = dec.getInitializer();
    if (init && init.getText() === "getOpikTracer()") {
      const stmt = dec.getFirstAncestorByKind(SyntaxKind.VariableStatement);
      if (stmt) {
        try { stmt.remove(); } catch (e) {}
      }
    }
  });

  // Clean opikTracer method calls
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
    const expr = call.getExpression();
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      if (expr.getText().startsWith("opikTracer.")) {
        const stmt = call.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
        if (stmt) {
           try { stmt.remove(); } catch (e) {}
        }
      }
    }
  });

  // Clean up initializeOpikTracer and initObservabilityFromEnv
  sourceFile.getVariableDeclarations().forEach(dec => {
    const init = dec.getInitializer();
    if (init && init.getKind() === SyntaxKind.AwaitExpression) {
      const text = init.getText();
      if (text.includes("initializeOpikTracer") || text.includes("initObservabilityFromEnv")) {
         const stmt = dec.getFirstAncestorByKind(SyntaxKind.VariableStatement);
         if (stmt) {
            try { stmt.remove(); } catch(e) {}
         }
      }
    }
  });

  sourceFile.saveSync();
}
