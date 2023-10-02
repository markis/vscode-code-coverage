import {
  window,
  DecorationOptions,
  Diagnostic,
  Disposable,
  Uri,
  Range,
  TextEditorDecorationType,
  OverviewRulerLane,
  MarkdownString,
  DiagnosticCollection,
} from "vscode";
import {
  CONFIG_OPTION_SHOW_DECORATIONS,
  ExtensionConfiguration,
} from "./extension-configuration";

const UNCOVERED_LINE_MESSAGE = "This line is missing code coverage.";

export interface CoverageDecoration {
  readonly decorationType: TextEditorDecorationType;
  readonly decorationOptions: DecorationOptions[];
}

export class CoverageDecorations extends Disposable {
  private _config: ExtensionConfiguration;
  private _isDisposed = false;
  private _decorationType: TextEditorDecorationType | undefined =
    CoverageDecorations._createDecorationType();
  private _fileCoverageDecorations = new Map<string, DecorationOptions[]>();
  // When a workspace is first opened and already has an open document, the setDecoration method has to be called twice.
  // If it is isn't, the user will have to tab between documents before the decorations will render.
  private _setDecorationsCounter = 0;

  get decorationType(): TextEditorDecorationType {
    this._checkDisposed();

    // will never be undefined if not disposed
    return this._decorationType as TextEditorDecorationType;
  }

  constructor(
    config: ExtensionConfiguration,
    diagnostics: DiagnosticCollection,
  ) {
    // use dummy function for callOnDispose since dispose() will be overrided
    super(() => true);
    this._config = config;

    this._config.onConfigOptionUpdated((e) => {
      if (e && e === CONFIG_OPTION_SHOW_DECORATIONS) {
        if (this._config.showDecorations) {
          this.displayCoverageDecorations(diagnostics);
        } else {
          this.clearAllDecorations();
        }
      }
    });
  }

  public override dispose(): void {
    if (!this._isDisposed) {
      this._fileCoverageDecorations.clear();
      this._decorationType = undefined;

      this._isDisposed = true;
    }
  }

  /** Display coverage decorations in active text editor */
  displayCoverageDecorations(diagnostics: DiagnosticCollection): void {
    const activeTextEditor = window.activeTextEditor;
    // Only want to call setDecorations at most 2 times.
    if (activeTextEditor && this._setDecorationsCounter < 2) {
      let decorations = this.getDecorationsForFile(
        activeTextEditor.document.uri,
      );

      // If VSCode launches the workspace with already opened document, this ensures the decorations will appear along with the diagnostics.
      if (!decorations) {
        this.addDecorationsForFile(
          activeTextEditor.document.uri,
          diagnostics.get(activeTextEditor.document.uri) ?? [],
        );
      } else {
        const { decorationType, decorationOptions } = decorations;
        activeTextEditor.setDecorations(decorationType, decorationOptions);
        this._setDecorationsCounter++;
      }
    }
  }

  addDecorationsForFile(file: Uri, diagnostics: readonly Diagnostic[]): void {
    this._checkDisposed();

    this._fileCoverageDecorations.set(
      file.toString(),
      this._mapDecorationOptions(diagnostics),
    );
  }

  getDecorationsForFile(file: Uri): CoverageDecoration | undefined {
    this._checkDisposed();
    const coverageDecorations = this._fileCoverageDecorations.get(
      file.toString(),
    );

    if (coverageDecorations !== undefined) {
      return {
        decorationType: this._decorationType as TextEditorDecorationType,
        decorationOptions: coverageDecorations,
      };
    }

    return coverageDecorations;
  }

  removeDecorationsForFile(file: Uri): void {
    this._checkDisposed();

    this._fileCoverageDecorations.delete(file.toString());
  }

  /** Clears the decorations counter when changing active text editor. */
  handleFileChange(): void {
    this._setDecorationsCounter = 0;
  }

  clearAllDecorations(): void {
    this._checkDisposed();

    this._fileCoverageDecorations.clear();
    window.activeTextEditor?.setDecorations(this.decorationType, []);
    window.visibleTextEditors.forEach((editor) => {
      editor.setDecorations(this.decorationType, []);
    });
  }

  /** Maps diagnostics to decoration options. */
  private _mapDecorationOptions(
    diagnostics: readonly Diagnostic[],
  ): DecorationOptions[] {
    // If decorations are disabled, return an empty array
    if (!this._config.showDecorations) {
      return [];
    }

    const makeDecoration = (start: number, end: number) => {
      return {
        hoverMessage: new MarkdownString(UNCOVERED_LINE_MESSAGE),
        range: new Range(start, 1, end, 1),
      };
    };

    // For a single diagnostic or none, create a single decoration or none.
    if (diagnostics.length <= 1) {
      return diagnostics.map((diag) =>
        makeDecoration(diag.range.start.line, diag.range.end.line),
      );
    }

    // Instead of creating a decoration for each diagnostic,
    // create a decoration for each contiguous set of lines marked with diagnostics.
    let decorations: DecorationOptions[] = [];
    let start = diagnostics[0].range.start.line;
    let end = diagnostics[0].range.end.line;
    for (let i = 0; i < diagnostics.length; ++i) {
      if (i === 0) {
        continue;
      }

      // If this a line number constitutes a segment, increase the end line number
      if (
        diagnostics[i - 1].range.end.line + 1 ===
        diagnostics[i].range.start.line
      ) {
        end = diagnostics[i].range.end.line;
        if (i + 1 < diagnostics.length) {
          continue;
        }
      }

      // Create decorations covering the found line segment
      decorations.push(makeDecoration(start, end));
      start = diagnostics[i].range.start.line;
      end = diagnostics[i].range.end.line;

      // If the very last diagnostic constitutes a point and is not part of any segment, create a decoration for it.
      if (
        i + 1 === diagnostics.length &&
        decorations[decorations.length - 1].range.end.line !== start
      ) {
        decorations.push(makeDecoration(start, end));
      }
    }

    return decorations;
  }

  private _checkDisposed() {
    if (this._isDisposed) {
      throw new Error("illegal state - object is disposed");
    }
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
