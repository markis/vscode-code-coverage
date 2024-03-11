import * as assert from "assert";
import { join } from "path";
import {
  commands,
  extensions,
  languages,
  Uri,
  window,
  workspace,
  Extension,
  ConfigurationTarget,
  CancellationToken,
} from "vscode";
import { ExtensionExports } from "../../src/extension";
import {
  CONFIG_OPTION_SHOW_DECORATIONS,
  CONFIG_SECTION_NAME,
} from "../../src/extension-configuration";
import { Coverage } from "../../src/coverage-info";

suite("code-coverage", function () {
  this.timeout(60000);
  const exampleWorkspace = join(__dirname, "../../../", "example");
  const exampleWorkspaceUri = Uri.file(exampleWorkspace);
  const exampleIndexUri = Uri.file(join(exampleWorkspace, "index.ts"));
  const exampleIndexFile = exampleIndexUri.fsPath;
  let extension: Extension<ExtensionExports> | undefined;
  let onCommand: (cmd: string) => Promise<void> | undefined;
  let exports: ExtensionExports | undefined;
  let exampleCoverage: Coverage | undefined;
  let exampleCancelToken: CancellationToken;

  setup(async () => {
    // Open the example workspace and open the example index file
    await commands.executeCommand("vscode.openFolder", exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexUri);
    await window.showTextDocument(doc);
    extension = extensions.getExtension("markis.code-coverage");
    exports = await extension?.activate();
    onCommand = exports?.onCommand ? exports.onCommand : async () => {};
    exampleCoverage = exports?.coverageByFile.get(exampleIndexFile);
    exampleCancelToken = {
      isCancellationRequested: false,
      onCancellationRequested: () => {
        return { dispose: () => {} };
      },
    };
  });

  teardown(async () => {
    exports?.coverageDecorations.clearAllDecorations();
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("searchCriteria", undefined);
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", undefined);
    // All done, close the editor
    commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("check diagnostics exist", async () => {
    // Check to see if the diagnostics exist for the example file
    // there should only be one line not covered, and so only one diagnostic should exist
    const diagnostics = languages.getDiagnostics(exampleIndexUri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].range.start.line, 5);
  });

  test("check status bar", async () => {
    // Check to see if the status bar is updated correctly
    // the example coverage should cover 3 out of 4 lines - "3/4"
    const statusBar = exports?.statusBar;
    assert.ok(statusBar);
    assert.ok(statusBar.text);
    assert.ok(statusBar.text.includes("3/4"));
  });

  test("test commands hide coverage", async () => {
    // Ensure coverage exists
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);

    // Hide coverage
    await onCommand("code-coverage.hide");
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 0);
  });

  test("test commands show coverage", async () => {
    // Show coverage
    await onCommand("code-coverage.show");
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);
  });

  test("test can update the coverage after updating showCriteria config value", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("searchCriteria", "lcov*.info");
    await onCommand("code-coverage.hide");
    await onCommand("code-coverage.show");
    let diagnostics = languages.getDiagnostics(exampleIndexUri);
    assert.strictEqual(diagnostics.length, 0);
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("searchCriteria", "coverage/lcov*.info");
    await onCommand("code-coverage.hide");
    await onCommand("code-coverage.show");
    diagnostics = languages.getDiagnostics(exampleIndexUri);
    assert.strictEqual(diagnostics.length, 1);
  });

  test("test can update the coverage threshold value after updating coverageThreshold config value", async () => {
    const initialValue =
      extension?.exports.extensionConfiguration.coverageThreshold;
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 25);
    assert.notEqual(
      extension?.exports.extensionConfiguration.coverageThreshold,
      initialValue,
    );
  });

  test("check decorations can be generated from coverage", async () => {
    const configuration = workspace.getConfiguration(CONFIG_SECTION_NAME);
    await configuration.update(
      CONFIG_OPTION_SHOW_DECORATIONS,
      true,
      ConfigurationTarget.Global,
    );

    assert.ok(exampleCoverage);
    const decorations = exports?.coverageDecorations.addDecorationsForFile(
      exampleIndexFile,
      exampleCoverage,
    );

    assert.ok(decorations);
    assert.strictEqual(decorations.length, 1);
  });

  test("test can generate file decorations from the coverage file when below threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 100);
    const exports = await extension?.activate();
    const decoration = exports?.fileCoverageInfoProvider.provideFileDecoration(
      exampleIndexUri,
      exampleCancelToken,
    );
    assert.ok(decoration);
  });

  test("test will not generate file decorations from the coverage file when above threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 25);
    const exports = await extension?.activate();
    const decoration = exports?.fileCoverageInfoProvider.provideFileDecoration(
      exampleIndexUri,
      exampleCancelToken,
    );
    assert.ok(!decoration);
  });

  test("test will hide file decorations when above threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 25);
    const decoration = exports?.fileCoverageInfoProvider.provideFileDecoration(
      exampleIndexUri,
      exampleCancelToken,
    );
    assert.ok(!decoration);
  });
});
