import * as assert from 'assert';
import { join } from 'path';
import { commands, languages, Uri, window, workspace } from 'vscode';

suite('code-coverage', function () {
  this.timeout(30000);
  test('open index.ts', async () => {
    const exampleWorkspace = join(__dirname, '../../../', 'example');
    const exampleWorkspaceUri = Uri.file(exampleWorkspace);
    const exampleIndexFile = join(exampleWorkspace, 'index.ts');

    await commands.executeCommand('vscode.openFolder', exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexFile);
    await window.showTextDocument(doc);

    const diagnostics = languages.getDiagnostics(doc.uri);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0].range.start.line, 5);

    commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
