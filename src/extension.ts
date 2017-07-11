import { readFile } from 'fs';
import { join } from 'path';
import { Diagnostic, DiagnosticCollection, DiagnosticSeverity, ExtensionContext, FileSystemWatcher, languages, Position, Range, Uri, workspace } from 'vscode';
import { Coverage, CoverageCollection, CoverageInfoCollection, BranchCoverageInfo, FunctionCoverageInfo, LineCoverageInfo } from './coverage-info';
import { parse as parseLcov } from './parse-lcov';
import { parse as parseConverageJson } from './parse-coverage-json';

let diagnostics: DiagnosticCollection;
export function activate(context: ExtensionContext) {
  let watcher: FileSystemWatcher;
  const packageInfo = require(join(context.extensionPath, 'package.json'));
  context.subscriptions.push(
    diagnostics = languages.createDiagnosticCollection('coverage'),
    watcher = workspace.createFileSystemWatcher('**/lcov*.info')
  );

  workspace.onDidChangeTextDocument(e => {
    diagnostics.delete(e.document.uri);
  });

  watcher.onDidChange(findDiagnostics);
  watcher.onDidCreate(findDiagnostics);
  watcher.onDidDelete(findDiagnostics);
  findDiagnostics();

  function findDiagnostics()  {
    workspace.findFiles('**/lcov*.info')
      .then(files => {
        for (const file of files) {
          parseLcov(file.fsPath).then(convertDiagnostics);
        }
      });

    // workspace.findFiles('**/coverage*.json')
    //   .then(files => {
    //     for (const file of files) {
    //       parseConverageJson(file.fsPath).then(convertDiagnostics);
    //     }
    //   });
  }

  function convertDiagnostics(coverages: CoverageCollection) {
    for (const coverage of coverages) {
      const diagnosticsForFiles: Diagnostic[] = [].concat(
        convertLinesToDiagnostics(coverage.lines.details),
        convertBranchesToDiagnostics(coverage.branches.details),
        convertFunctionsToDiagnostics(coverage.functions.details)
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
            `[${packageInfo.name}] statement uncovered`,
            DiagnosticSeverity.Information
          )
        );
      }
    }
    return diagnosticsForFiles;
  }

  function convertBranchesToDiagnostics(branches: BranchCoverageInfo[]) {
    const diagnosticsForFiles: Diagnostic[] = [];
    for (const branch of branches) {
      if (branch.hit === 0) {
        diagnosticsForFiles.push(
          new Diagnostic(
            new Range(
              new Position(branch.line - 1, 0),
              new Position(branch.line - 1, Number.MAX_VALUE)
            ),
            `[${packageInfo.name}] statement uncovered`,
            DiagnosticSeverity.Information
          )
        );
      }
    }
    return diagnosticsForFiles;
  }

  function convertFunctionsToDiagnostics(functions: FunctionCoverageInfo[]) {
    const diagnosticsForFiles: Diagnostic[] = [];
    for (const func of functions) {
      if (func.hit === 0) {
        diagnosticsForFiles.push(
          new Diagnostic(
            new Range(
              new Position(func.line - 1, 0),
              new Position(func.line - 1, Number.MAX_VALUE)
            ),
            `[${packageInfo.name}] method '${func.name}' uncovered`,
            DiagnosticSeverity.Information
          )
        );
      }
    }
    return diagnosticsForFiles;
  }

}

export function deactivate() {
  diagnostics.dispose();
}


