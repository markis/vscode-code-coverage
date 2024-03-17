import {
  ConfigurationChangeEvent,
  Disposable,
  EventEmitter,
  WorkspaceConfiguration,
} from "vscode";

export const CONFIG_SECTION_NAME = "markiscodecoverage";
const DEFAULT_SHOW_COVERAGE = true;
const DEFAULT_SHOW_DECORATIONS = false;
const DEFAULT_SEARCH_CRITERIA = "coverage/lcov*.info";
const DEFAULT_CODE_COVERAGE_THRESHOLD = 80;

export enum ConfigurationOptions {
  enableOnStartup = "enableOnStartup",
  searchCriteria = "searchCriteria",
  coverageThreshold = "coverageThreshold",
  showDecorations = "enableDecorations",
}

export class ExtensionConfiguration extends Disposable {
  constructor(
    config: WorkspaceConfiguration,
    public showCoverage = config.get(
      ConfigurationOptions.enableOnStartup,
      DEFAULT_SHOW_COVERAGE,
    ),
    public showDecorations = config.get(
      ConfigurationOptions.showDecorations,
      DEFAULT_SHOW_DECORATIONS,
    ),
    public searchCriteria = config.get(
      ConfigurationOptions.searchCriteria,
      DEFAULT_SEARCH_CRITERIA,
    ),
    public coverageThreshold = config.get(
      ConfigurationOptions.coverageThreshold,
      DEFAULT_CODE_COVERAGE_THRESHOLD,
    ),
    private configSectionName = CONFIG_SECTION_NAME,
    private readonly _onConfigOptionUpdated:
      | EventEmitter<string>
      | undefined = new EventEmitter<string>(),
  ) {
    super(() => {
      _onConfigOptionUpdated.dispose();
    });
  }

  public onConfigOptionUpdated(listener: (e: string) => any): Disposable {
    if (!this._onConfigOptionUpdated) return Disposable.from();
    return this._onConfigOptionUpdated.event(listener);
  }

  dispatchConfigUpdate(
    evtSrc: ConfigurationChangeEvent,
    latestSnapshot: WorkspaceConfiguration,
  ): void {
    if (!this._onConfigOptionUpdated) return;

    if (this._hasBeenUpdated(evtSrc, ConfigurationOptions.searchCriteria)) {
      this.searchCriteria = latestSnapshot.get(
        ConfigurationOptions.searchCriteria,
        DEFAULT_SEARCH_CRITERIA,
      );
      this._onConfigOptionUpdated.fire(ConfigurationOptions.searchCriteria);
    } else if (
      this._hasBeenUpdated(evtSrc, ConfigurationOptions.coverageThreshold)
    ) {
      this.coverageThreshold = latestSnapshot.get(
        ConfigurationOptions.coverageThreshold,
        DEFAULT_CODE_COVERAGE_THRESHOLD,
      );
      this._onConfigOptionUpdated.fire(ConfigurationOptions.coverageThreshold);
    } else if (
      this._hasBeenUpdated(evtSrc, ConfigurationOptions.showDecorations)
    ) {
      this.showDecorations = latestSnapshot.get(
        ConfigurationOptions.showDecorations,
        DEFAULT_SHOW_DECORATIONS,
      );
      this._onConfigOptionUpdated.fire(ConfigurationOptions.showDecorations);
    }
  }

  private _hasBeenUpdated(
    evtSrc: ConfigurationChangeEvent,
    optionName: string,
  ): boolean {
    return evtSrc.affectsConfiguration(
      `${this.configSectionName}.${optionName}`,
    );
  }
}
