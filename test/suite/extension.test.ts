import { expect } from 'chai';
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
    expect(diagnostics).to.have.length(1);
    expect(diagnostics[0].range.start.line).to.be.equal(5);

    commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
