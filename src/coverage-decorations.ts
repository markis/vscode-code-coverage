import {
  window,
  DecorationOptions,
  Disposable,
  Uri,
  Range,
  TextEditorDecorationType,
  OverviewRulerLane,
  MarkdownString,
} from "vscode";
import {
  CONFIG_OPTION_SHOW_DECORATIONS,
  ExtensionConfiguration,
} from "./extension-configuration";
import { Coverage } from "./coverage-info";

const UNCOVERED_LINE_MESSAGE = "This line is missing code coverage.";

export interface CoverageDecoration {
  readonly decorationType: TextEditorDecorationType;
  readonly decorationOptions: DecorationOptions[];
}

export class CoverageDecorations extends Disposable {
  constructor(
    private _config: ExtensionConfiguration,
    private _coverageByFile: Map<string, Coverage>,
    private _isDisposing = false,
    private readonly _decorationType = CoverageDecorations._createDecorationType(),
    private readonly _fileCoverageDecorations = new Map<string, DecorationOptions[]>(),
    _listeners: Disposable[] = [],
  ) {
    super(() => {
      this._isDisposing = true;
      _fileCoverageDecorations.clear();
      _decorationType.dispose();

      for (const listener of _listeners) listener.dispose();
    });

    _listeners.push(
      this._config.onConfigOptionUpdated((e) => {
        if (e && e === CONFIG_OPTION_SHOW_DECORATIONS && window.activeTextEditor) {
          const activeFile = window.activeTextEditor.document.uri.fsPath;
          const coverage = this._coverageByFile.get(activeFile);

          coverage && this._config.showDecorations
            ? this.displayCoverageDecorations(coverage)
            : this.clearAllDecorations();
        }
      })
    );
  }

  /** Display coverage decorations in active text editor */
  displayCoverageDecorations(coverage?: Coverage): void {
    if (this._isDisposing) return;

    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) return;
    const file = activeTextEditor.document.uri.fsPath;
    let decorations = this._fileCoverageDecorations.get(file);
    if (!coverage) {
      coverage = this._coverageByFile.get(file);
    }
    if (!decorations && coverage) {
      decorations = this._mapDecorationOptions(coverage);
      this._fileCoverageDecorations.set(file, decorations);
    }
    if (decorations) {
      activeTextEditor.setDecorations(this._decorationType, decorations);
    }
  }

  addDecorationsForFile(file: string, coverage: Coverage): DecorationOptions[] | undefined {
    if (this._isDisposing) return undefined;

    const decorations = this._mapDecorationOptions(coverage);
    this._fileCoverageDecorations.set(file, decorations);
    return decorations;
  }

  removeDecorationsForFile(file: Uri): void {
    if (this._isDisposing) return undefined;

    this._fileCoverageDecorations.delete(file.fsPath);
  }

  /** Clears the decorations counter when changing active text editor. */
  handleFileChange(): void {
    this.displayCoverageDecorations();
  }

  clearAllDecorations(): void {
    if (this._isDisposing) return undefined;

    this._fileCoverageDecorations.clear();
    window.activeTextEditor?.setDecorations(this._decorationType, []);
    window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this._decorationType, []);
    });
  }

  /** Maps diagnostics to decoration options. */
  private _mapDecorationOptions(coverage: Coverage): DecorationOptions[] {
    if (this._isDisposing || !this._config.showDecorations) {
      return [];
    }

    const lineNums = coverage.lines.details.filter((line) => line.hit === 0).map((line) => line.line - 1);
    const groupedLines = this.groupConsecutiveNumbers(lineNums);
    const decorations: DecorationOptions[] = [];
    for (const [start, end] of groupedLines) {
      const decoration = CoverageDecorations.makeDecoration(start, end);
      decorations.push(decoration);
    }
    return decorations;
  }

  private groupConsecutiveNumbers(numbers: number[]): Array<[number, number]> {
    const sortedNumbers = numbers.sort((a, b) => a - b);
    const result: Array<[number, number]> = [];
    let currentGroup: [number, number] | null = null;

    for (const num of sortedNumbers) {
      if (!currentGroup) {
        currentGroup = [num, num];
      } else if (num === currentGroup[1] + 1) {
        currentGroup[1] = num;
      } else {
        result.push(currentGroup);
        currentGroup = [num, num];
      }
    }

    if (currentGroup) {
      result.push(currentGroup);
    }

    return result;
  }


  private static makeDecoration(start: number, end: number) {
    return {
      hoverMessage: new MarkdownString(UNCOVERED_LINE_MESSAGE),
      range: new Range(start, 1, end, 1),
    };
  }

  private static _createDecorationType(): TextEditorDecorationType {
    return window.createTextEditorDecorationType({
      isWholeLine: true,
      overviewRulerLane: OverviewRulerLane.Full,
      overviewRulerColor: { id: "markiscodecoverage.colorUncoveredLineRuler" },
      backgroundColor: { id: "markiscodecoverage.colorUncoveredLineText" },
    });
  }
}
