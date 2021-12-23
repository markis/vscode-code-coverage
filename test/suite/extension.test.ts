import * as assert from 'assert';
import { join } from 'path';
import { commands, extensions, languages, StatusBarItem, Uri, window, workspace } from 'vscode';

suite('code-coverage', function() {
  this.timeout(30000);

  const exampleWorkspace = join(__dirname, '../../../', 'example');
  const exampleWorkspaceUri = Uri.file(exampleWorkspace);
  const exampleIndexUri = Uri.file(join(exampleWorkspace, 'index.ts'));
  const extension = extensions.getExtension("markis.code-coverage");

  setup(async () => {
    // Open the example workspace and open the example index file
    await commands.executeCommand('vscode.openFolder', exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexUri);
    await window.showTextDocument(doc);
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

  test('test commands hide/show coverage', async () => {
    const onCommand = extension?.exports.onCommand;

    // Ensure coverage exists
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);

    // Hide coverage
    await onCommand('code-coverage.hide');
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 0);

    // Show coverage
    await onCommand('code-coverage.show');
    assert.strictEqual(languages.getDiagnostics(exampleIndexUri).length, 1);
  });
});
