import { join } from 'path';
import { Diagnostic, DiagnosticSeverity, ExtensionContext, languages, Position, Range, Uri, RelativePattern, workspace, window } from 'vscode';
import { Coverage, CoverageCollection, LineCoverageInfo } from './coverage-info';
import { parse as parseLcov } from './parse-lcov';
import { createModeHandler, DiagnosticsModeHandler, DiagnosticsMode } from './diagnostic-mode';

const CONFIG_KEY = 'markiscodecoverage';
const CONFIG_KEY_SEARCH_CRITERIA = 'searchCriteria';
const CONFIG_KEY_DETAIL_COVERAGE_MODE = 'detailCoverageMode';
const CONFIG_KEY_SUMMARY_WITH_CURLY = 'summaryWithCurly';

const DEFAULT_SEARCH_CRITERIA = 'coverage/lcov*.info';
const DEFAULT_DETAIL_COVERAGE_MODE = 'all';
const DEFAULT_SUMMARY_WITH_CURLY = true;

export function activate(context: ExtensionContext) {
  const packageInfo = require(join(context.extensionPath, 'package.json'));
  const diagnostics = languages.createDiagnosticCollection('coverage');
  const statusBar = window.createStatusBarItem();
  const coverageByfile = new Map<string, Coverage>();
  const workspaceFolders = workspace.workspaceFolders;

  // apply workspace settings
  const config = workspace.getConfiguration(CONFIG_KEY);

  const configSearchCriteria = config.has(CONFIG_KEY_SEARCH_CRITERIA) && config.get(CONFIG_KEY_SEARCH_CRITERIA);
  const searchCriteria = configSearchCriteria && typeof configSearchCriteria === 'string' ?
    configSearchCriteria : DEFAULT_SEARCH_CRITERIA;

    const configDetailCoverageMode = config.has(CONFIG_KEY_DETAIL_COVERAGE_MODE) && config.get(CONFIG_KEY_DETAIL_COVERAGE_MODE);
  const detailCoverageMode = configDetailCoverageMode && typeof configDetailCoverageMode === 'string' ?
    configDetailCoverageMode : DEFAULT_DETAIL_COVERAGE_MODE;

    const configSummaryWithCurly = config.has(CONFIG_KEY_SUMMARY_WITH_CURLY) && config.get(CONFIG_KEY_SUMMARY_WITH_CURLY);
  const summaryWithCurly = typeof configSummaryWithCurly === 'boolean' ? configSummaryWithCurly : DEFAULT_SUMMARY_WITH_CURLY;

  const modeHandler: DiagnosticsModeHandler = createModeHandler(detailCoverageMode, showDetailedDiagnostics, showSummaryDiagnostics);

  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const pattern = new RelativePattern(folder.uri.fsPath, searchCriteria);
      const watcher = workspace.createFileSystemWatcher(pattern);
      watcher.onDidChange(() => findDiagnostics());
      watcher.onDidCreate(() => findDiagnostics());
      watcher.onDidDelete(() => findDiagnostics());
    }
  }

  context.subscriptions.push(diagnostics, statusBar);

  workspace.onDidChangeTextDocument(e => {
    if (e) {
      diagnostics.delete(e.document.uri);
      coverageByfile.delete(e.document.uri.fsPath.toLowerCase());
      showStatus();
    }
  });
  workspace.onDidOpenTextDocument(() => {
    showStatus();
    modeHandler.openTextDocument();
  });
  workspace.onDidCloseTextDocument(() => {
    showStatus();
    modeHandler.closeTextDocument();
  });
  window.onDidChangeActiveTextEditor(() => {
    showStatus();
    modeHandler.changeActiveEditor();
  });

  findDiagnostics();

  function findDiagnostics()  {
    workspace.findFiles(searchCriteria)
      .then(files => {
        for (const file of files) {
          parseLcov(file.fsPath)
            .then(coverages => {
              recordFileCoverage(coverages);
              convertDiagnostics(coverages);
            });
        }
      });
  }

  function showStatus() {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      statusBar.hide();
      return;
    }
    const file: string = activeTextEditor.document.uri.fsPath.toLowerCase();
    if (coverageByfile.has(file)) {
      const coverage = coverageByfile.get(file);
      if (coverage) {
        const { lines } = coverage;

        statusBar.text = `Coverage: ${lines.hit}/${lines.found} lines`;
        statusBar.show();
      }
    } else {
      statusBar.hide ();
    }
  }

  function recordFileCoverage(coverages: CoverageCollection) {
    coverageByfile.clear();
    for (const coverage of coverages) {
      coverageByfile.set(coverage.file.toLowerCase(), coverage);
    }
    showStatus();
    modeHandler.coverageReady();
  }

  function convertDiagnostics(coverages: CoverageCollection) {
    for (const coverage of coverages) {
      if (coverage && coverage.lines && coverage.lines.details) {
        const diagnosticsForFiles: Diagnostic[] = generateDiagnostics(coverage);
        if (diagnosticsForFiles.length > 0) {
          diagnostics.set(Uri.file(coverage.file), diagnosticsForFiles);
        } else {
          diagnostics.delete(Uri.file(coverage.file));
        }
      }
    }
  }

  function generateDiagnostics(coverage: Coverage): Diagnostic[] {
    switch (modeHandler.initialDiagnosticMode()) {
      case DiagnosticsMode.Summary:
        return convertSummaryToDiagnostics(coverage);
      case DiagnosticsMode.Detailed:
        return convertLinesToDiagnostics(coverage.lines.details);
      case DiagnosticsMode.NoDiagnostics:
        return [];
    }
  }

  function convertSummaryToDiagnostics(coverage: Coverage): Diagnostic[] {
    if (coverage.lines.hit === coverage.lines.found) {
      return [];
    }
    if (coverage.lines.details.length <= 0) {
      return [];
    }
    let indexStart = 0;
    let indexEnd = coverage.lines.details.length - 1;
    while (indexStart < indexEnd) {
      if (coverage.lines.details[indexStart].hit !== 0) {
        break;
      }
      indexStart++;
    }
    while (indexEnd > indexStart) {
      if (coverage.lines.details[indexEnd].hit !== 0) {
        break;
      }
      indexEnd--;
    }
    if (indexStart > indexEnd) {
      return [];
    }
    const diagnosticsForFiles: Diagnostic[] = [];
    const startLine = coverage.lines.details[indexStart].line;
    let endLine = coverage.lines.details[indexEnd].line;
    let endPos = Number.MAX_VALUE;
    const { lines } = coverage;
    if (!summaryWithCurly) {
      endLine = startLine;
      endPos = 0;
    }
    diagnosticsForFiles.push(
      new Diagnostic(
        new Range(
          new Position(startLine - 1, 0),
          new Position(endLine - 1, endPos)
        ),
        `[${packageInfo.name}] covered ${lines.hit}/${lines.found} lines`,
        DiagnosticSeverity.Information
      )
    );
    return diagnosticsForFiles;
  }

  function convertLinesToDiagnostics(details: LineCoverageInfo[]): Diagnostic[] {
    const diagnosticsForFiles: Diagnostic[] = [];
    for (const detail of details) {
      if (detail.hit === 0) {
        diagnosticsForFiles.push(
          new Diagnostic(
            new Range(
              new Position(detail.line - 1, 0),
              new Position(detail.line - 1, Number.MAX_VALUE)
            ),
            `[${packageInfo.name}] line not covered`,
            DiagnosticSeverity.Information
          )
        );
      }
    }
    return diagnosticsForFiles;
  }

  function showDetailedDiagnostics(path:string) {
    diagnostics.delete(Uri.file(path));

    if (!coverageByfile.has(path.toLowerCase())) {
      return;
    }
    const coverage = coverageByfile.get(path.toLowerCase());
    if (!coverage) {
      return;
    }

    const diagnosticsForFiles: Diagnostic[] = convertLinesToDiagnostics(coverage.lines.details);
    if (diagnosticsForFiles.length > 0) {
      diagnostics.set(Uri.file(path), diagnosticsForFiles);
    } else {
      diagnostics.delete(Uri.file(path));
    }
  }

  function showSummaryDiagnostics(path:string) {
    diagnostics.delete(Uri.file(path));

    if (!coverageByfile.has(path.toLowerCase())) {
      return;
    }
    const coverage = coverageByfile.get(path.toLowerCase());
    if (!coverage) {
      return;
    }

    const diagnosticsForFiles: Diagnostic[] = convertSummaryToDiagnostics(coverage);
    if (diagnosticsForFiles.length > 0) {
      diagnostics.set(Uri.file(path), diagnosticsForFiles);
    } else {
      diagnostics.delete(Uri.file(path));
    }
  }
}
