// Check the web application without pulling separately packaged PaperClaw integrations into its program.
import ts from "typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const sourceRoot = path.join(root, "src") + path.sep;
const rootNames = config.fileNames.filter(file => path.normalize(file).startsWith(sourceRoot) || file.endsWith("next-env.d.ts"));
const program = ts.createProgram(rootNames, { ...config.options, noEmit: true, incremental: false });
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else {
  console.log(`Web typecheck passed (${rootNames.length} source files).`);
}
