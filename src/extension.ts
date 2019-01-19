import { join } from 'path';
import { Diagnostic, DiagnosticSeverity, ExtensionContext, languages, Position, Range, Uri, RelativePattern, workspace, window } from 'vscode';
import { Coverage, CoverageCollection, LineCoverageInfo } from './coverage-info';
import { parse as parseLcov } from './parse-lcov';

const DEFAULT_SEARCH_CRITERIA = 'coverage/lcov*.info';

export function activate(context: ExtensionContext) {
  const packageInfo = require(join(context.extensionPath, 'package.json'));
  const diagnostics = languages.createDiagnosticCollection('coverage');
  const statusBar = window.createStatusBarItem();
  const coverageByfile = new Map<string, Coverage>();

  const config = workspace.getConfiguration('markiscodecoverage');
  const configSearchCriteria = config.has('searchCriteria') && config.get('searchCriteria');
  const searchCriteria = configSearchCriteria && typeof configSearchCriteria === 'string' ?
    configSearchCriteria : DEFAULT_SEARCH_CRITERIA;
  const workspaceFolders = workspace.workspaceFolders;

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
      showStatus(e.document.uri.fsPath);
    }
  });
  workspace.onDidOpenTextDocument(e => {
    if (e) {
      showStatus(e.fileName);
    }
  });
  workspace.onDidCloseTextDocument(() => {
    statusBar.hide();
  });
  window.onDidChangeActiveTextEditor(e => {
    if (e) {
      showStatus(e.document.fileName);
    }
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

  function showStatus(file: string) {
    file = file.toLowerCase();
    if (coverageByfile.has(file)) {
      const coverage = coverageByfile.get(file);
      if (coverage) {
        const { lines } = coverage;

        statusBar.text = `Coverage: ${lines.hit}/${lines.found} lines`;
        statusBar.show();
      }
    }
  }

  function recordFileCoverage(coverages: CoverageCollection) {
    coverageByfile.clear();
    for (const coverage of coverages) {
      coverageByfile.set(coverage.file.toLowerCase(), coverage);
    }
    const activeTextEditor = window.activeTextEditor;
    if (activeTextEditor) {
      showStatus(activeTextEditor.document.uri.fsPath);
    }
  }

  function convertDiagnostics(coverages: CoverageCollection) {
    for (const coverage of coverages) {
      if (coverage && coverage.lines && coverage.lines.details) {
        const diagnosticsForFiles: Diagnostic[] =
          convertLinesToDiagnostics(coverage.lines.details);

        if (diagnosticsForFiles.length > 0) {
          diagnostics.set(Uri.file(coverage.file), diagnosticsForFiles);
        } else {
          diagnostics.delete(Uri.file(coverage.file));
        }
      }
    }
  }

  function convertLinesToDiagnostics(details: LineCoverageInfo[]) {
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
}
