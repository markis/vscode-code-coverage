import {
  CancellationToken,
  Disposable,
  EventEmitter,
  FileDecoration,
  FileDecorationProvider,
  ProviderResult,
  ThemeColor,
  Uri,
} from "vscode";
import {
  CONFIG_OPTION_COVERAGE_THRESHOLD,
  ExtensionConfiguration,
} from "./extension-configuration";
import { Coverage } from "./coverage-info";

const FILE_DECORATION_BADGE = "<%";
const FILE_DECORATION_TOOLTIP_PRELUDE = "Insufficent Code Coverage:";
type UriEventEmitterType = Uri[] | undefined;
type FileDecorationsEmitterType = EventEmitter<UriEventEmitterType> | undefined;

/**
 * This class provides file decorations for the Explore View based on code coverage.
 * It listens for changes to the coverage threshold and regenerates the file decorations when it changes.
 */
export class FileCoverageInfoProvider
  extends Disposable
  implements FileDecorationProvider
{
  constructor(
    private readonly _configuration: ExtensionConfiguration,
    private readonly _coverageByFile: Map<string, Coverage>,
    private _showFileDecorations = _configuration.showDecorations,
    private _coverageThreshold = _configuration.coverageThreshold,
    private _isDisposing = false,
    private _fileDecorationsEmitter: FileDecorationsEmitterType = new EventEmitter<UriEventEmitterType>(),
    public readonly onDidChangeFileDecorations = _fileDecorationsEmitter.event,
    _listeners: Disposable[] = [_fileDecorationsEmitter],
  ) {
    super(() => {
      this._isDisposing = true;
      for (const listener of _listeners) listener.dispose();
      delete this._fileDecorationsEmitter;
    });

    // Watch for updates to coverage threshold and regenerate when its updated
    _listeners.push(
      _configuration.onConfigOptionUpdated(this.handleConfigUpdate.bind(this)),
    );
  }

  /**
   * @description This method shows the file decorations for the Explore View.
   */
  public showCoverage(): void {
    this._showFileDecorations = true;
    this.updateFileDecorations();
  }

  /**
   * @description This method hides the file decorations for the Explore View.
   */
  public hideCoverage(): void {
    this._showFileDecorations = false;
    this.updateFileDecorations();
  }

  /**
   * @param fsPaths The file(s) to decorate
   * @description This method is called by the extension to fire the onDidChangeFileDecorations event for the specified file(s).
   */
  public updateFileDecorations(): void {
    if (this._isDisposing || !this._fileDecorationsEmitter) return;

    const uris = Array.from(this._coverageByFile.keys()).map((path) =>
      Uri.file(path),
    );
    this._fileDecorationsEmitter.fire(uris);
  }

  /**
   * @param uri The file to decorate
   * @param _token
   * @returns The decoration to apply to the file
   * @description This method is called by VSCode to decorate a file in the Explore View.
   */
  public provideFileDecoration(
    uri: Uri,
    _token: CancellationToken,
  ): ProviderResult<FileDecoration> {
    if (this._isDisposing || !this._showFileDecorations) return;

    const cls = FileCoverageInfoProvider;
    const coverage = this._coverageByFile.get(uri.fsPath);
    if (coverage) {
      const percentCovered = cls.calculateCoveragePercent(coverage.lines);
      if (percentCovered < this._coverageThreshold) {
        return new FileDecoration(
          FILE_DECORATION_BADGE,
          `${FILE_DECORATION_TOOLTIP_PRELUDE} ${percentCovered}% vs. ${this._coverageThreshold}%.`,
          new ThemeColor("markiscodecoverage.insufficientCoverageForeground"),
        );
      }
    }
  }

  /**
   * @param e The configuration option that was updated
   * @description This method is called when a configuration option is updated.
   * It checks if the coverage threshold was updated and updates the coverage threshold if it was.
   * It then regenerates the file decorations.
   */
  private handleConfigUpdate(e: string): void {
    if (
      this._isDisposing ||
      e !== CONFIG_OPTION_COVERAGE_THRESHOLD ||
      this._coverageThreshold === this._configuration.coverageThreshold
    ) {
      return;
    }

    this._coverageThreshold = this._configuration.coverageThreshold;
    this.updateFileDecorations();
  }

  /**
   * @param lines The coverage data for a file
   * @returns The coverage percentage
   * @description This method calculates the coverage percentage based on the number of lines hit and the number of lines found.
   */
  private static calculateCoveragePercent(lines: {
    hit: number;
    found: number;
  }): number {
    return Math.floor((lines.hit / lines.found) * 100);
  }
}
