import * as fs from 'fs';
import * as path from 'path';
import { CoverageCollection, Coverage } from './coverage-info';

interface CoverageJson {
  [file: string]: {
    s?: {
      [statementId: string]: number;
    },
    statementMap?: {
      [statementId: string]: {
        end: {
          column: number;
          line: number;
        }
        start: {
          column: number;
          line: number;
        }
      }
    }
  }
};

export function parse(file: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    fs.exists(file, exists => {
      const promises: Array<Promise<CoverageCollection>> = [];
      !exists ?
        parseJson(file).then(resolve).catch(reject) :
        fs.readFile(file, 'utf8', (err, str) => {
          parseJson(str).then(resolve).catch(reject);
        });
    });
  });
};

function parseJson(json: string): Promise<CoverageCollection> {
  return new Promise((resolve, reject) => {
    const coverageCollection: CoverageCollection = [];
    const coverages: CoverageJson = JSON.parse(json);

    for (const coveredFile in coverages) {
      const coverageData = coverages[coveredFile];
      const coverageInfo: Coverage = {
        file: coveredFile,
        branches: { details: [] },
        lines: { details: [] },
        functions: { details: [] }
      } as any;
      const { s, statementMap } = coverageData;
      const statementDetails = coverageInfo.lines.details;

      if (s && statementMap) {
        for (const statementId in s) {
          const statementCount = s[statementId];
          if (statementCount === 0) {
            const statement = statementMap[statementId];
            const { start } = statement;
            if (start) {
              statementDetails.push({
                line: start.line,
                hit: statementCount
              });
            }
          }
        }
      }
    }
  });
}


// function parseConverageJson(files: Uri[]) {
//   for (const file of files) {
//     convertCoverageToDiagnostics(require(file.fsPath));
//   }
// }

// function convertCoverageToDiagnostics(coverages: CoverageJson) {
//   for (const coveredFile in coverages) {
//     const coverage = coverages[coveredFile];
//     const { s, statementMap } = coverage;

//     const diagnosticsForFiles: Diagnostic[] = [];
//     if (s && statementMap) {
//       for (const statementId in s) {
//         const statementCount = s[statementId];
//         if (statementCount === 0) {
//           const statement = statementMap[statementId];
//           const { start, end } = statement;
//           if (start && end) {
            // diagnosticsForFiles.push(
            //   new Diagnostic(
            //     new Range(
            //       new Position(statement.start.line - 1, statement.start.column),
            //       new Position(statement.end.line - 1, statement.end.column)
            //     ),
            //     `[${packageInfo.name}] statement uncovered`,
            //     DiagnosticSeverity.Warning
            //   )
            // );
//           }
//         }
//       }
//     }

//     if (diagnosticsForFiles.length > 0) {
//       diagnostics.set(Uri.file(coveredFile), diagnosticsForFiles);
//     }
//   }
// }