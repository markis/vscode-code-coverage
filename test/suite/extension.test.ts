import { join } from 'path';
import { commands, Uri, window, workspace } from 'vscode';

suite('code-coverage', () => {
  test.skip('open index.ts', async () => {
    const exampleWorkspace = join(__dirname, '../../', 'example');
    const exampleWorkspaceUri = Uri.file(exampleWorkspace);
    const exampleIndexFile = join(exampleWorkspace, 'index.ts');

    await commands.executeCommand('vscode.openFolder', exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexFile);
    await window.showTextDocument(doc);
  });
});
