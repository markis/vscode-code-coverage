import * as assert from "assert";
import { join } from "path";
import {
  commands,
  extensions,
  languages,
  StatusBarItem,
  Uri,
  window,
  workspace,
  Extension,
} from "vscode";

suite("code-coverage", function () {
  this.timeout(10000);
  const exampleWorkspace = join(__dirname, "../../../", "example");
  const exampleWorkspaceUri = Uri.file(exampleWorkspace);
  const exampleIndexUri = Uri.file(join(exampleWorkspace, "index.ts"));
  let extension: Extension<any> | undefined;
  let onCommand: (cmd: string) => Promise<void> | undefined;

  setup(async () => {
    // Open the example workspace and open the example index file
    await commands.executeCommand("vscode.openFolder", exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexUri);
    await window.showTextDocument(doc);
    extension = extensions.getExtension("markis.code-coverage");
    onCommand = extension?.exports.onCommand;
  });

  teardown(async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("searchCriteria", undefined);
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", undefined);
    // All done, close the editor
    commands.executeCommand("workbench.action.closeActiveEditor");
  });

  this.afterEach = () => {
    extension?.exports.coverageDecorations.clearAllDecorations();
    return this;
  };

  test("check diagnostics exist", async () => {
    // Check to see if the diagnostics exist for the example file
    // there should only be one line not covered, and so only one diagnostic should exist
    const diagnostics = languages.getDiagnostics(exampleIndexUri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].range.start.line, 5);
  });

  test("check decorations can be generated from diagnostics and retrieved", async () => {
    const diagnostics = languages.getDiagnostics(exampleIndexUri);
    extension?.exports.coverageDecorations.addDecorationsForFile(
      exampleIndexUri,
      diagnostics,
    );
    const decorationSpec =
      extension?.exports.coverageDecorations.getDecorationsForFile(
        exampleIndexUri,
      );
    assert.notEqual(decorationSpec, undefined);
    assert.strictEqual(decorationSpec.decorationOptions.length, 1);
  });

  test("check status bar", async () => {
    // Check to see if the status bar is updated correctly
    // the example coverage should cover 3 out of 4 lines - "3/4"
    const statusBar: StatusBarItem = extension?.exports.statusBar;
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

  test("test can generate file decorations from the coverage file when below threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 100);
    const decoration =
      extension?.exports.fileCoverageInfoProvider.provideFileDecoration(
        exampleIndexUri,
      );
    assert.notEqual(decoration, undefined);
  });

  test("test will not generate file decorations from the coverage file when above threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 25);
    const decoration =
      extension?.exports.fileCoverageInfoProvider.provideFileDecoration(
        exampleIndexUri,
      );
    assert.strictEqual(decoration, undefined);
  });

  test("test will hide file decorations when above threshold", async () => {
    await workspace
      .getConfiguration("markiscodecoverage")
      .update("coverageThreshold", 25);
    const decoration =
      extension?.exports.fileCoverageInfoProvider.provideFileDecoration(
        exampleIndexUri,
      );
    assert.strictEqual(decoration, undefined);
  });
});
