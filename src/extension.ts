import { isAbsolute, join } from "path";
import {
  commands,
  Diagnostic,
  DiagnosticSeverity,
  ExtensionContext,
  languages,
  Position,
  Range,
  RelativePattern,
  Uri,
  window,
  workspace,
  WorkspaceFolder,
} from "vscode";
import {
  Coverage,
  CoverageCollection,
  LineCoverageInfo,
} from "./coverage-info";
import { parse as parseLcov } from "./parse-lcov";

const DEFAULT_SEARCH_CRITERIA = "coverage/lcov*.info";

export let onCommand: (cmd: string) => Promise<void> = noop;

export async function deactivate() {
  onCommand = noop;
}

export async function activate(context: ExtensionContext) {
  const packageInfo = require(join(context.extensionPath, "package.json"));
  const diagnostics = languages.createDiagnosticCollection("coverage");
  const statusBar = window.createStatusBarItem();
  const hideCommand = commands.registerCommand(
    `${packageInfo.name}.hide`,
    onHideCoverage
  );
  const showCommand = commands.registerCommand(
    `${packageInfo.name}.show`,
    onShowCoverage
  );
  const coverageByFile = new Map<string, Coverage>();
  let showCoverage = true;

  const config = workspace.getConfiguration("markiscodecoverage");
  const configSearchCriteria =
    config.has("searchCriteria") && config.get("searchCriteria");
  const searchCriteria =
    configSearchCriteria && typeof configSearchCriteria === "string"
      ? configSearchCriteria
      : DEFAULT_SEARCH_CRITERIA;
  const workspaceFolders = workspace.workspaceFolders;

  // Register watchers for file changes on coverage files to re-run the coverage parser
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const pattern = new RelativePattern(folder.uri.fsPath, searchCriteria);
      const watcher = workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(() => findDiagnostics(folder));
      watcher.onDidCreate(() => findDiagnostics(folder));
      watcher.onDidDelete(() => findDiagnostics(folder));
    }
  }

  context.subscriptions.push(diagnostics, statusBar, showCommand, hideCommand);

  // Update status bar on changes to any open file
  workspace.onDidChangeTextDocument((e) => {
    if (e) {
      diagnostics.delete(e.document.uri);
      showStatus();
    }
  });
  workspace.onDidOpenTextDocument(() => {
    showStatus();
  });
  workspace.onDidCloseTextDocument(() => {
    showStatus();
  });
  window.onDidChangeActiveTextEditor(() => {
    showStatus();
  });

  // Run the main routine at activation time as well
  await findDiagnosticsInWorkspace();

  onCommand = async function onCommand(cmd: string) {
    switch (cmd) {
      case `${packageInfo.name}.hide`:
        return onHideCoverage();
      case `${packageInfo.name}.show`:
        return onShowCoverage();
    }
  };

  async function onHideCoverage() {
    showCoverage = false;
    diagnostics.clear();
  }

  async function onShowCoverage() {
    showCoverage = true;
    await findDiagnosticsInWorkspace();
  }

  async function findDiagnosticsInWorkspace() {
    if (workspaceFolders) {
      await Promise.all(workspaceFolders.map(findDiagnostics));
    }
  }

  // Finds VSCode diagnostics to display based on a coverage file specified by the search pattern in each workspace folder
  async function findDiagnostics(workspaceFolder: WorkspaceFolder) {
    const searchPattern = new RelativePattern(workspaceFolder, searchCriteria);
    const files = await workspace.findFiles(searchPattern);
    for (const file of files) {
      const coverages = await parseLcov(file.fsPath);
      recordFileCoverage(coverages, workspaceFolder.uri.fsPath);
      convertDiagnostics(coverages, workspaceFolder.uri.fsPath);
    }
  }

  // Show the coverage in the VSCode status bar at the bottom
  function showStatus() {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      statusBar.hide();
      return;
    }
    const file: string = activeTextEditor.document.uri.fsPath;
    if (coverageByFile.has(file)) {
      const coverage = coverageByFile.get(file);
      if (coverage) {
        const { lines } = coverage;

        statusBar.text = `Coverage: ${lines.hit}/${lines.found} lines`;
        statusBar.show();
      }
    } else {
      statusBar.hide();
    }
  }

  function recordFileCoverage(
    coverages: CoverageCollection,
    workspaceFolder: string
  ) {
    coverageByFile.clear();
    for (const coverage of coverages) {
      const fileName = !isAbsolute(coverage.file)
        ? join(workspaceFolder, coverage.file)
        : coverage.file;

      coverageByFile.set(fileName, coverage);
    }
    showStatus();
  }

  // Takes parsed coverage information and turns it into diagnostics
  function convertDiagnostics(
    coverages: CoverageCollection,
    workspaceFolder: string
  ) {
    if (!showCoverage) return; // do nothing

    for (const coverage of coverages) {
      if (coverage && coverage.lines && coverage.lines.details) {
        const fileName = !isAbsolute(coverage.file)
          ? join(workspaceFolder, coverage.file)
          : coverage.file;

        const diagnosticsForFiles: Diagnostic[] = convertLinesToDiagnostics(
          coverage.lines.details,
          fileName
        );

        if (diagnosticsForFiles.length > 0) {
          diagnostics.set(Uri.file(fileName), diagnosticsForFiles);
        } else {
          diagnostics.delete(Uri.file(fileName));
        }
      }
    }
  }

  function convertLinesToDiagnostics(
    details: LineCoverageInfo[],
    fileName: string
  ) {
    const currentFile = window.activeTextEditor?.document.uri.fsPath;
    const diagnosticsForFiles: Diagnostic[] = [];

    for (const detail of details) {
      const line = detail.line - 1;
      if (detail.hit === 0) {
        const range =
          (currentFile === fileName &&
            window.activeTextEditor?.document.lineAt(line).range) ||
          new Range(new Position(line, 0), new Position(line, 1000));
        diagnosticsForFiles.push(
          new Diagnostic(
            range,
            `[${packageInfo.name}] line not covered`,
            DiagnosticSeverity.Information
          )
        );
      }
    }
    return diagnosticsForFiles;
  }

  // exports - accessible to tests
  return { onCommand, statusBar };
}

async function noop() {}
