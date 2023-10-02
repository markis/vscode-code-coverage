import {
  ConfigurationChangeEvent,
  Disposable,
  Event,
  EventEmitter,
  WorkspaceConfiguration,
} from "vscode";

export const CONFIG_SECTION_NAME = "markiscodecoverage";
export const CONFIG_OPTION_ENABLE_ON_STARTUP = "enableOnStartup";
export const CONFIG_OPTION_SEARCH_CRITERIA = "searchCriteria";
export const CONFIG_OPTION_COVERAGE_THRESHOLD = "coverageThreshold";
export const CONFIG_OPTION_SHOW_DECORATIONS = "enableDecorations";

export const DEFAULT_SEARCH_CRITERIA = "coverage/lcov*.info";
export const DEFAULT_CODE_COVERAGE_THRESHOLD = 80;

export class ExtensionConfiguration extends Disposable {
  private readonly _onConfigOptionUpdated = new EventEmitter<string>();
  private _isDisposed = false;
  private _showCoverage = true;
  private _searchCriteria = "";
  private _coverageThreshold = 0;
  private _showDecorations = false;

  constructor(config: WorkspaceConfiguration) {
    // use dummy function for callOnDispose since dispose() will be overrided
    super(() => true);

    this.showCoverage =
      !config.has(CONFIG_OPTION_ENABLE_ON_STARTUP) ||
      (config.get(CONFIG_OPTION_ENABLE_ON_STARTUP) ?? true);

    const configSearchCriteria =
      config.has(CONFIG_OPTION_SEARCH_CRITERIA) &&
      config.get(CONFIG_OPTION_SEARCH_CRITERIA);
    this.searchCriteria =
      configSearchCriteria && typeof configSearchCriteria === "string"
        ? configSearchCriteria
        : DEFAULT_SEARCH_CRITERIA;

    this.coverageThreshold =
      config.get(CONFIG_OPTION_COVERAGE_THRESHOLD) ??
      DEFAULT_CODE_COVERAGE_THRESHOLD;

    this.showDecorations = config.get(CONFIG_OPTION_SHOW_DECORATIONS, false);
  }

  public override dispose(): void {
    if (!this._isDisposed) {
      this._onConfigOptionUpdated.dispose();

      this._isDisposed = true;
    }
  }

  get showCoverage() {
    this._checkDisposed();
    return this._showCoverage;
  }
  set showCoverage(value: boolean) {
    this._checkDisposed();
    this._showCoverage = value;
  }

  get showDecorations() {
    this._checkDisposed();
    return this._showDecorations;
  }
  set showDecorations(value: boolean) {
    this._checkDisposed();
    this._showDecorations = value;
  }

  get searchCriteria() {
    this._checkDisposed();
    return this._searchCriteria;
  }
  set searchCriteria(value: string) {
    this._checkDisposed();
    this._searchCriteria = value;
  }

  get coverageThreshold() {
    this._checkDisposed();
    return this._coverageThreshold;
  }
  set coverageThreshold(value: number) {
    this._checkDisposed();
    this._coverageThreshold = value;
  }

  get onConfigOptionUpdated(): Event<string> {
    this._checkDisposed();
    return this._onConfigOptionUpdated.event;
  }

  dispatchConfigUpdate(
    evtSrc: ConfigurationChangeEvent,
    latestSnapshot: WorkspaceConfiguration,
  ): void {
    this._checkDisposed();

    if (this._hasBeenUpdated(evtSrc, CONFIG_OPTION_SEARCH_CRITERIA)) {
      const configSearchCriteria =
        latestSnapshot.has(CONFIG_OPTION_SEARCH_CRITERIA) &&
        latestSnapshot.get(CONFIG_OPTION_SEARCH_CRITERIA);
      this.searchCriteria =
        configSearchCriteria && typeof configSearchCriteria === "string"
          ? configSearchCriteria
          : this.searchCriteria;

      this._onConfigOptionUpdated.fire(CONFIG_OPTION_SEARCH_CRITERIA);
    } else if (this._hasBeenUpdated(evtSrc, CONFIG_OPTION_COVERAGE_THRESHOLD)) {
      this.coverageThreshold =
        latestSnapshot.get(CONFIG_OPTION_COVERAGE_THRESHOLD) ??
        this.coverageThreshold;

      this._onConfigOptionUpdated.fire(CONFIG_OPTION_COVERAGE_THRESHOLD);
    } else if (this._hasBeenUpdated(evtSrc, CONFIG_OPTION_SHOW_DECORATIONS)) {
      this.showDecorations = latestSnapshot.get(
        CONFIG_OPTION_SHOW_DECORATIONS,
        this.showDecorations,
      );

      this._onConfigOptionUpdated.fire(CONFIG_OPTION_SHOW_DECORATIONS);
    }
  }

  private _hasBeenUpdated(
    evtSrc: ConfigurationChangeEvent,
    optionName: string,
  ): boolean {
    return evtSrc.affectsConfiguration(`${CONFIG_SECTION_NAME}.${optionName}`);
  }

  private _checkDisposed() {
    if (this._isDisposed) {
      throw new Error("illegal state - object is disposed");
    }
  }
}
