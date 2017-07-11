import { join } from 'path';
import { commands, Diagnostic, languages, Uri, window, workspace } from 'vscode';

suite('code-coverage', () => {
  test.skip('open index.ts', async () => {
    const exampleWorkspace = join(__dirname, '../../', 'example');
    const exampleWorkspaceUri = Uri.file(exampleWorkspace);
    const exampleIndexFile = join(exampleWorkspace, 'index.ts');
    const exampleIndexFileUri = Uri.file(exampleIndexFile);

    await commands.executeCommand('vscode.openFolder', exampleWorkspaceUri);
    const doc = await workspace.openTextDocument(exampleIndexFile);
    const editor = await window.showTextDocument(doc);
  });
});
