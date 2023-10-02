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
import {
  CONFIG_OPTION_SEARCH_CRITERIA,
  CONFIG_SECTION_NAME,
  ExtensionConfiguration,
} from "./extension-configuration";
import { parse as parseLcov } from "./parse-lcov";
import { CoverageDecorations } from "./coverage-decorations";
import { FileCoverageInfoProvider } from "./file-coverage-info-provider";

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
    onHideCoverage,
  );
  const showCommand = commands.registerCommand(
    `${packageInfo.name}.show`,
    onShowCoverage,
  );
  const coverageByFile = new Map<string, Coverage>();

  const extensionConfiguration = new ExtensionConfiguration(
    workspace.getConfiguration(CONFIG_SECTION_NAME),
  );
  const workspaceFolders = workspace.workspaceFolders;
  const coverageDecorations = new CoverageDecorations(
    extensionConfiguration,
    diagnostics,
  );

  // Register watchers and listen if the coverage file directory has changed
  registerWatchers();
  extensionConfiguration.onConfigOptionUpdated((e) => {
    if (e && e === CONFIG_OPTION_SEARCH_CRITERIA) {
      registerWatchers();
    }
  });

  // Create and Register the file decoration provider
  const fileCoverageInfoProvider = new FileCoverageInfoProvider(
    extensionConfiguration,
    coverageByFile,
  );
  const fileCoverageInfoProviderRegistration =
    window.registerFileDecorationProvider(fileCoverageInfoProvider);

  context.subscriptions.push(
    extensionConfiguration,
    diagnostics,
    coverageDecorations,
    statusBar,
    showCommand,
    hideCommand,
    fileCoverageInfoProviderRegistration,
    fileCoverageInfoProvider,
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
  workspace.onDidChangeConfiguration((e) => {
    if (e) {
      extensionConfiguration.dispatchConfigUpdate(
        e,
        workspace.getConfiguration(CONFIG_SECTION_NAME),
      );
    }
  });
  window.onDidChangeActiveTextEditor(() => {
    coverageDecorations.handleFileChange();
    showStatusAndDecorations();
  });

  // Run the main routine at activation time as well
  await findDiagnosticsInWorkspace();

  // Register watchers for file changes on coverage files to re-run the coverage parser
  function registerWatchers() {
    if (workspaceFolders) {
      for (const folder of workspaceFolders) {
        const pattern = new RelativePattern(
          folder.uri.fsPath,
          extensionConfiguration.searchCriteria,
        );
        const watcher = workspace.createFileSystemWatcher(pattern);
        watcher.onDidChange(() => findDiagnostics(folder));
        watcher.onDidCreate(() => findDiagnostics(folder));
        watcher.onDidDelete(() => findDiagnostics(folder));
      }
    }
  }

  onCommand = async function onCommand(cmd: string) {
    switch (cmd) {
      case `${packageInfo.name}.hide`:
        return onHideCoverage();
      case `${packageInfo.name}.show`:
        return onShowCoverage();
    }
  };

  async function onHideCoverage() {
    extensionConfiguration.showCoverage = false;
    fileCoverageInfoProvider.showFileDecorations = false;
    fileCoverageInfoProvider.changeFileDecorations(
      Array.from(coverageByFile.keys()),
    );
    diagnostics.clear();
    coverageDecorations.clearAllDecorations();
  }

  async function onShowCoverage() {
    extensionConfiguration.showCoverage = true;
    fileCoverageInfoProvider.showFileDecorations = true;
    await findDiagnosticsInWorkspace();
    coverageDecorations.displayCoverageDecorations(diagnostics);
  }

  async function findDiagnosticsInWorkspace() {
    if (workspaceFolders) {
      await Promise.all(workspaceFolders.map(findDiagnostics));
      fileCoverageInfoProvider.changeFileDecorations(
        Array.from(coverageByFile.keys()),
      );
    }
  }

  // Finds VSCode diagnostics to display based on a coverage file specified by the search pattern in each workspace folder
  async function findDiagnostics(workspaceFolder: WorkspaceFolder) {
    const searchPattern = new RelativePattern(
      workspaceFolder,
      extensionConfiguration.searchCriteria,
    );
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
        coverageDecorations.displayCoverageDecorations(diagnostics);
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
    if (!extensionConfiguration.showCoverage) return; // do nothing

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
  return {
    onCommand,
    statusBar,
    coverageDecorations,
    fileCoverageInfoProvider,
    extensionConfiguration,
  };
}

async function noop() {}
