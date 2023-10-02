import {
  CancellationToken,
  Disposable,
  Event,
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
import * as os from "node:os";

const isWindows = () => os.type() === "Windows_NT";

const FILE_DECORATION_BADGE = "<%";
const FILE_DECORATION_TOOLTIP_PRELUDE = "Insufficent Code Coverage:";
type UriEventEmitterType = Uri | Uri[] | undefined;

export class FileCoverageInfoProvider
  extends Disposable
  implements FileDecorationProvider
{
  private readonly _onDidChangeFileDecorations =
    new EventEmitter<UriEventEmitterType>();
  private readonly _coverageByFile: Map<string, Coverage>;
  private _listener: Disposable;
  private _isDisposed = false;
  private _showFileDecorations = true;
  private _coverageThreshold = 0;

  constructor(
    readonly configuration: ExtensionConfiguration,
    readonly coverageByFile: Map<string, Coverage>,
  ) {
    // use dummy function for callOnDispose since dispose() will be overrided
    super(() => true);

    this._coverageByFile = coverageByFile;
    this._coverageThreshold = configuration.coverageThreshold;

    // Watch for updates to coverage threshold and regenerate when its updated
    this._listener = configuration.onConfigOptionUpdated((e) => {
      if (
        e &&
        e === CONFIG_OPTION_COVERAGE_THRESHOLD &&
        configuration.coverageThreshold !== this._coverageThreshold
      ) {
        this._coverageThreshold = configuration.coverageThreshold;
        this.changeFileDecorations(Array.from(this._coverageByFile.keys()));
      }
    });
  }

  public override dispose(): void {
    if (!this._isDisposed) {
      this._onDidChangeFileDecorations.dispose();
      this._listener.dispose();

      this._isDisposed = true;
    }
  }

  // Toggle display of the decorations in Explore View
  get showFileDecorations(): boolean {
    this._checkDisposed();
    return this._showFileDecorations;
  }
  set showFileDecorations(value: boolean) {
    this._checkDisposed();
    this._showFileDecorations = value;
  }

  // The event that window.registerFileDecorationProvider() subscribes to
  get onDidChangeFileDecorations(): Event<UriEventEmitterType> {
    this._checkDisposed();
    return this._onDidChangeFileDecorations.event;
  }

  // Either decorates or undecorates a file within the Explore View
  provideFileDecoration(
    uri: Uri,
    _token: CancellationToken,
  ): ProviderResult<FileDecoration> {
    this._checkDisposed();

    if (!this.showFileDecorations) {
      return;
    }

    let path = uri.fsPath;
    // Uri.file() might lowercase the drive letter on some machines which might not match coverageByFile's keys
    // Encountered this issue on a Windows 11 machine but not my main Windows 10 system...
    if (!this._coverageByFile.has(path) && isWindows()) {
      path = path.charAt(0).toUpperCase().concat(path.substring(1));
    }

    const coverage = this._coverageByFile.get(path);
    if (coverage) {
      const { lines } = coverage;
      const percentCovered = Math.floor((lines.hit / lines.found) * 100);

      if (percentCovered < this._coverageThreshold) {
        return new FileDecoration(
          FILE_DECORATION_BADGE,
          `${FILE_DECORATION_TOOLTIP_PRELUDE} ${percentCovered}% vs. ${this._coverageThreshold}%.`,
          new ThemeColor("markiscodecoverage.insufficientCoverageForeground"),
        );
      }
    }
  }

  // Fire the onDidChangeFileDecorations event for the specified file(s)
  changeFileDecorations(fsPaths: string | string[]): void {
    this._checkDisposed();

    if (typeof fsPaths === "string") {
      this._onDidChangeFileDecorations.fire([Uri.file(fsPaths)]);
    }

    this._onDidChangeFileDecorations.fire(
      (fsPaths as string[]).map((p) => Uri.file(p)),
    );
  }

  private _checkDisposed() {
    if (this._isDisposed) {
      throw new Error("illegal state - object is disposed");
    }
  }
}
