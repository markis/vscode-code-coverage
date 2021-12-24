import * as assert from 'assert';
import { join } from 'path';
import { commands, extensions, languages, StatusBarItem, Uri, window, workspace, Extension } from 'vscode';

suite('code-coverage', function() {
  const exampleWorkspace = join(__dirname, '../../../', 'example');
  const exampleWorkspaceUri = Uri.file(exampleWorkspace);
  const exampleIndexUri = Uri.file(join(exampleWorkspace, 'index.ts'));
  let extension: Extension<any> | undefined;
  let onCommand: (cmd: string) => Promise<void> | undefined;
  

  setup(async () => {
    // Open the example workspace and open the example index file
    await commands.executeCommand('vscode.openFolder', exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexUri);
    await window.showTextDocument(doc);
    extension = extensions.getExtension("markis.code-coverage");
    onCommand = extension?.exports.onCommand;
  });

  teardown(async () => {
    // All done, close the editor
    commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('check diagnostics exist', async () => {
    // Check to see if the diagnostics exist for the example file
    // there should only be one line not covered, and so only one diagnostic should exist
    const diagnostics = languages.getDiagnostics(exampleIndexUri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].range.start.line, 5);
  });

  test('check status bar', async () => {
    // Check to see if the status bar is updated correctly
    // the example coverage should cover 3 out of 4 lines - "3/4"
    const statusBar: StatusBarItem = extension?.exports.statusBar;
    assert.ok(statusBar.text);
    assert.ok(statusBar.text.includes('3/4'))
  });

  test('test commands hide coverage', async () => {
    // Ensure coverage exists
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);

    // Hide coverage
    await onCommand('code-coverage.hide');
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 0);
  });

  test('test commands show coverage', async () => {
    // Show coverage
    await onCommand('code-coverage.show');
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);
  });
});
