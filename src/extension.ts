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
import { CoverageDecorations } from "./coverage-decorations";

const DEFAULT_SEARCH_CRITERIA = "coverage/lcov*.info";

export let onCommand: (cmd: string) => Promise<void> = noop;

export async function deactivate() {
  onCommand = noop;
}

export async function activate(context: ExtensionContext) {
  const packageInfo = require(join(context.extensionPath, "package.json"));
  const diagnostics = languages.createDiagnosticCollection("coverage");
  const coverageDecorations = new CoverageDecorations();
  const statusBar = window.createStatusBarItem();
  const hideCommand = commands.registerCommand(
    `${packageInfo.name}.hide`,
    onHideCoverage,
  );
  const showCommand = commands.registerCommand(
    `${packageInfo.name}.show`,
    onShowCoverage,
  );
  const coverageByFile = new Map<string, Coverage>();

  const config = workspace.getConfiguration("markiscodecoverage");
  let showCoverage =
    !config.has("enableOnStartup") || config.get("enableOnStartup");
  const configSearchCriteria =
    config.has("searchCriteria") && config.get("searchCriteria");
  const searchCriteria =
    configSearchCriteria && typeof configSearchCriteria === "string"
      ? configSearchCriteria
      : DEFAULT_SEARCH_CRITERIA;
  const workspaceFolders = workspace.workspaceFolders;

  // When a workspace is first opened and already has an open document, the setDecoration method has to be called twice.
  // If it is isn't, the user will have to tab between documents before the decorations will render.
  let setDecorationsCounter = 0;

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

  context.subscriptions.push(
    diagnostics,
    coverageDecorations,
    statusBar,
    showCommand,
    hideCommand,
  );

  // Update status bar on changes to any open file
  workspace.onDidChangeTextDocument((e) => {
    if (e) {
      diagnostics.delete(e.document.uri);
      coverageDecorations.removeDecorationsForFile(e.document.uri);
      showStatusAndDecorations();
    }
  });
  workspace.onDidOpenTextDocument(() => {
    showStatusAndDecorations();
  });
  workspace.onDidCloseTextDocument(() => {
    showStatusAndDecorations();
  });
  window.onDidChangeActiveTextEditor(() => {
    setDecorationsCounter = 0;
    showStatusAndDecorations();
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
    coverageDecorations.clearAllDecorations();
    // Disable rendering of decorations in editor view
    window.activeTextEditor?.setDecorations(
      coverageDecorations.decorationType,
      [],
    );
  }

  async function onShowCoverage() {
    showCoverage = true;
    await findDiagnosticsInWorkspace();

    // This ensures the decorations will show up again when switching back and forth between Show / Hide.
    const activeTextEditor = window.activeTextEditor;
    if (activeTextEditor !== undefined) {
      const decorations = coverageDecorations.getDecorationsForFile(
        activeTextEditor.document.uri,
      );

      if (decorations !== undefined) {
        const { decorationType, decorationOptions } = decorations;
        // Render decorations in editor view
        activeTextEditor.setDecorations(decorationType, decorationOptions);
      }
    }
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
  function showStatusAndDecorations() {
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
        // Only want to call setDecorations at most 2 times.
        if (setDecorationsCounter < 2) {
          let decorations = coverageDecorations.getDecorationsForFile(
            activeTextEditor.document.uri,
          );

          // If VSCode launches the workspace with already opened document, this ensures the decorations will appear along with the diagnostics.
          if (decorations === undefined) {
            coverageDecorations.addDecorationsForFile(
              activeTextEditor.document.uri,
              diagnostics.get(activeTextEditor.document.uri) ?? [],
            );
            decorations = coverageDecorations.getDecorationsForFile(
              activeTextEditor.document.uri,
            );
          } else {
            const { decorationType, decorationOptions } = decorations;
            activeTextEditor.setDecorations(decorationType, decorationOptions);
            setDecorationsCounter++;
          }
        }
        statusBar.text = `Coverage: ${lines.hit}/${lines.found} lines`;
        statusBar.show();
      }
    } else {
      statusBar.hide();
    }
  }

  function recordFileCoverage(
    coverages: CoverageCollection,
    workspaceFolder: string,
  ) {
    coverageByFile.clear();
    for (const coverage of coverages) {
      const fileName = !isAbsolute(coverage.file)
        ? join(workspaceFolder, coverage.file)
        : coverage.file;

      coverageByFile.set(fileName, coverage);
    }
    showStatusAndDecorations();
  }

  // Takes parsed coverage information and turns it into diagnostics
  function convertDiagnostics(
    coverages: CoverageCollection,
    workspaceFolder: string,
  ) {
    if (!showCoverage) return; // do nothing

    for (const coverage of coverages) {
      if (coverage && coverage.lines && coverage.lines.details) {
        const fileName = !isAbsolute(coverage.file)
          ? join(workspaceFolder, coverage.file)
          : coverage.file;

        const diagnosticsForFiles: Diagnostic[] = convertLinesToDiagnostics(
          coverage.lines.details,
          fileName,
        );

        if (diagnosticsForFiles.length > 0) {
          const file = Uri.file(fileName);
          diagnostics.set(file, diagnosticsForFiles);
          coverageDecorations.addDecorationsForFile(file, diagnosticsForFiles);
        } else {
          const file = Uri.file(fileName);
          diagnostics.delete(file);
          coverageDecorations.removeDecorationsForFile(file);
        }
      }
    }
  }

  function convertLinesToDiagnostics(
    details: LineCoverageInfo[],
    fileName: string,
  ) {
    const doc = window.activeTextEditor?.document;
    const currentFile = doc?.uri.fsPath;
    const diagnosticsForFiles: Diagnostic[] = [];
    for (const detail of details) {
      const line = detail.line - 1;
      if (detail.hit === 0) {
        const range =
          (currentFile === fileName && doc?.lineAt(line).range) ||
          new Range(new Position(line, 0), new Position(line, 1000));
        diagnosticsForFiles.push(
          new Diagnostic(
            range,
            `[${packageInfo.name}] line not covered`,
            DiagnosticSeverity.Information,
          ),
        );
      }
    }
    return diagnosticsForFiles;
  }

  // exports - accessible to tests
  return { onCommand, statusBar, coverageDecorations };
}

async function noop() {}
