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
  ConfigurationOptions,
  ExtensionConfiguration,
} from "./extension-configuration";
import { Coverage } from "./coverage-info";
import { debounce } from "./utils";

export const UNCOVERED_LINE_MESSAGE = "This line is missing code coverage.";

export interface CoverageDecoration {
  readonly decorationType: TextEditorDecorationType;
  readonly decorationOptions: DecorationOptions[];
}

/**
 * @param coverage The coverage information to map to decoration options
 * @returns The decoration options for the uncovered lines in the coverage information
 * @description This method maps the coverage information to decoration options for the uncovered lines.
 * exported for testing purposes
 */
export function mapDecorationOptions(coverage: Coverage): DecorationOptions[] {
  if (!coverage?.lines?.details || !coverage?.lines?.found) return [];
  return (
    coverage.lines.details
      // Filter out lines that are covered
      .filter((line) => line.hit === 0)
      // Convert LineCoverageInfo to line numbers
      .map((line) => line.line - 1)
      // Sort the line numbers
      .sort((a, b) => a - b)
      // Convert line numbers to ranges
      .reduce((result: Array<[number, number]>, num: number) => {
        // Convert a list of numbers to a list of ranges
        // e.g. [1,2,3,5,6,7,9] => [[1,3],[5,7],[9,9]]
        const lastGroup = result[result.length - 1];

        if (!lastGroup) {
          result.push([num, num]);
        } else if (num === lastGroup[1] + 1) {
          lastGroup[1] = num;
        } else {
          result.push([num, num]);
        }

        return result;
      }, [])
      // Convert ranges to decoration options
      .map(([start, end]) => ({
        hoverMessage: new MarkdownString(UNCOVERED_LINE_MESSAGE),
        range: new Range(start, 1, end, 1),
      }))
  );
}

/**
 * @returns A new TextEditorDecorationType
 * @description Creates a new TextEditorDecorationType for uncovered lines
 * in the coverage information.
 */
function createDecorationType(): TextEditorDecorationType {
  return window.createTextEditorDecorationType({
    isWholeLine: true,
    overviewRulerLane: OverviewRulerLane.Full,
    overviewRulerColor: { id: "markiscodecoverage.colorUncoveredLineRuler" },
    backgroundColor: { id: "markiscodecoverage.colorUncoveredLineText" },
  });
}

export class CoverageDecorations extends Disposable {
  constructor(
    private _config: ExtensionConfiguration,
    private _coverageByFile: Map<string, Coverage>,
    private _isDisposing = false,
    private readonly _decorationType = createDecorationType(),
    private readonly _fileCoverageDecorations = new Map<
      string,
      DecorationOptions[]
    >(),
    _listeners: Disposable[] = [],
  ) {
    super(() => {
      this._isDisposing = true;
      _fileCoverageDecorations.clear();
      _decorationType.dispose();

      for (const listener of _listeners) listener.dispose();
    });

    const [debouncedFunc, debounceDispose] = debounce(
      this.displayCoverageDecorations.bind(this),
      100,
    );
    this.displayCoverageDecorations = debouncedFunc;

    _listeners.push(
      this._config.onConfigOptionUpdated(this.onConfigOptionUpdated.bind(this)),
      debounceDispose,
    );
  }

  /**
   * @param coverage The coverage information to display decorations for
   * @description Displays decorations for the uncovered lines in the coverage information.
   * This method is debounced to prevent flickering when the file is loading.
   * Debouncing is done by the constructor.
   */
  public displayCoverageDecorations(coverage?: Coverage): void {
    if (this._isDisposing || !this._config.showDecorations) return;

    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) return;
    const file = activeTextEditor.document.uri.fsPath;
    let decorations = this._fileCoverageDecorations.get(file);
    if (!coverage) {
      coverage = this._coverageByFile.get(file);
    }
    if (!decorations && coverage) {
      decorations = mapDecorationOptions(coverage);
      this._fileCoverageDecorations.set(file, decorations);
    }
    if (decorations) {
      activeTextEditor.setDecorations(this._decorationType, decorations);
    }
  }

  /**
   * @param file The file to add decorations for
   * @param coverage The coverage information to add decorations for
   * @returns The decoration options for the uncovered lines in the coverage information
   * @description Adds decorations for the specified file based on the coverage information.
   */
  public addDecorationsForFile(
    file: string,
    coverage: Coverage,
  ): DecorationOptions[] | undefined {
    if (this._isDisposing || !this._config.showDecorations) return undefined;

    const decorations = mapDecorationOptions(coverage);
    this._fileCoverageDecorations.set(file, decorations);
    return decorations;
  }

  /**
   * @param file The file to remove decorations for
   * @description Removes the decorations for the specified file.
   */
  public removeDecorationsForFile(file: Uri): void {
    if (this._isDisposing) return undefined;

    this._fileCoverageDecorations.delete(file.fsPath);
  }

  /**
   * @description Clears all decorations from all files.
   */
  public clearAllDecorations(): void {
    if (this._isDisposing) return undefined;

    this._fileCoverageDecorations.clear();
    window.activeTextEditor?.setDecorations(this._decorationType, []);
    window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this._decorationType, []);
    });
  }

  /**
   * @description Event is fired when the user changes the active text editor.
   */
  public onFileChange(): void {
    this.displayCoverageDecorations();
  }

  /**
   * @description Handle configuration option updated event.
   * @param configOption The configuration option that was updated
   */
  private onConfigOptionUpdated(configOption: string): void {
    if (
      configOption === ConfigurationOptions.showDecorations &&
      window.activeTextEditor
    ) {
      const activeFile = window.activeTextEditor.document.uri.fsPath;
      const coverage = this._coverageByFile.get(activeFile);

      coverage && this._config.showDecorations
        ? this.displayCoverageDecorations(coverage)
        : this.clearAllDecorations();
    }
  }
}
