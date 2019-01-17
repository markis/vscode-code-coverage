import { join } from 'path';
import { Diagnostic, DiagnosticSeverity, ExtensionContext, languages, Position, Range, Uri, RelativePattern, workspace, window } from 'vscode';
import { Coverage, CoverageCollection, BranchCoverageInfo, FunctionCoverageInfo, LineCoverageInfo } from './coverage-info';
import { parse as parseLcov } from './parse-lcov';

export function activate(context: ExtensionContext) {
  const packageInfo = require(join(context.extensionPath, 'package.json'));
  const diagnostics = languages.createDiagnosticCollection('coverage');
  const statusBar = window.createStatusBarItem();
  const coverageByfile = new Map<string, Coverage>();

  let searchCriteria = 'coverage/lcov*.info';
  const config = workspace.getConfiguration("markiscodecoverage");
  if (config.has("searchCriteria") && config.get("searchCriteria") != "") {
    searchCriteria = config.get("searchCriteria");
  }
  for (const folder of workspace.workspaceFolders) {
    const pattern = new RelativePattern(folder.uri.fsPath, searchCriteria);
    const watcher = workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(e => findDiagnostics());
    watcher.onDidCreate(e => findDiagnostics());
    watcher.onDidDelete(e => findDiagnostics());
  }

  context.subscriptions.push(diagnostics, statusBar);

  workspace.onDidChangeTextDocument(e => {
    diagnostics.delete(e.document.uri);
    showStatus(e.document.uri.fsPath);
  });
  workspace.onDidOpenTextDocument(e => {
    showStatus(e.fileName);
  });
  workspace.onDidCloseTextDocument(() => {
    statusBar.hide();
  });
  window.onDidChangeActiveTextEditor(e => {
    showStatus(e.document.fileName);
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
      const { branches, lines, functions } = coverage;

      statusBar.text = `Coverage: ${lines.hit}/${lines.found} lines`;
      statusBar.show();
    }
  }

  function recordFileCoverage(coverages: CoverageCollection) {
    coverageByfile.clear();
    for (const coverage of coverages) {
      coverageByfile.set(coverage.file.toLowerCase(), coverage);
    }
    showStatus(window.activeTextEditor.document.uri.fsPath);
  }

  function convertDiagnostics(coverages: CoverageCollection) {
    for (const coverage of coverages) {
      const diagnosticsForFiles: Diagnostic[] = [].concat(
        convertLinesToDiagnostics(coverage.lines.details)
      );

      if (diagnosticsForFiles.length > 0) {
        diagnostics.set(Uri.file(coverage.file), diagnosticsForFiles);
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

  // function convertBranchesToDiagnostics(branches: BranchCoverageInfo[]) {
  //   const diagnosticsForFiles: Diagnostic[] = [];
  //   for (const branch of branches) {
  //     if (branch.hit === 0) {
  //       diagnosticsForFiles.push(
  //         new Diagnostic(
  //           new Range(
  //             new Position(branch.line - 1, 0),
  //             new Position(branch.line - 1, Number.MAX_VALUE)
  //           ),
  //           `[${packageInfo.name}] statement uncovered`,
  //           DiagnosticSeverity.Information
  //         )
  //       );
  //     }
  //   }
  //   return diagnosticsForFiles;
  // }

  // function convertFunctionsToDiagnostics(functions: FunctionCoverageInfo[]) {
  //   const diagnosticsForFiles: Diagnostic[] = [];
  //   for (const func of functions) {
  //     if (func.hit === 0) {
  //       diagnosticsForFiles.push(
  //         new Diagnostic(
  //           new Range(
  //             new Position(func.line - 1, 0),
  //             new Position(func.line - 1, Number.MAX_VALUE)
  //           ),
  //           `[${packageInfo.name}] method '${func.name}' uncovered`,
  //           DiagnosticSeverity.Information
  //         )
  //       );
  //     }
  //   }
  //   return diagnosticsForFiles;
  // }
}
