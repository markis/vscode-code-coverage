import { window } from 'vscode';

export function createModeHandler(config: string, showDetailedDiagnostics:(path: string) => void, showSummaryDiagnostics:(path: string) => void): DiagnosticsModeHandler {
  switch (config) {
    case "all":
      return new AllDetailDiagnosticsHandler();
    case "never":
      return new NeverDetailDiagnosticsHandler();
    case "open":
      return new OpenDocumentsDetailDiagnosticsHandler(showDetailedDiagnostics, showSummaryDiagnostics);
    case "active":
      return new ActiveDocumentsDetailDiagnosticsHandler(showDetailedDiagnostics, showSummaryDiagnostics);
    default:
      return new AllDetailDiagnosticsHandler();
  }
}

export interface DiagnosticsModeHandler {
  coverageReady(): void;
  initialDiagnosticMode(): DiagnosticsMode;
  openTextDocument(): void;
  closeTextDocument(): void;
  changeActiveEditor(): void;
}

export enum DiagnosticsMode {
  Summary,
  Detailed,
  NoDiagnostics
}

class AllDetailDiagnosticsHandler implements DiagnosticsModeHandler {
  coverageReady(): void {}
  initialDiagnosticMode(): DiagnosticsMode {
    return DiagnosticsMode.Detailed;
  }
  openTextDocument(): void {}
  closeTextDocument(): void {}
  changeActiveEditor(): void {}
}

class NeverDetailDiagnosticsHandler implements DiagnosticsModeHandler {
  coverageReady(): void {}
  initialDiagnosticMode(): DiagnosticsMode {
    return DiagnosticsMode.Summary;
  }
  openTextDocument(): void {}
  closeTextDocument(): void {}
  changeActiveEditor(): void {}
}

class OpenDocumentsDetailDiagnosticsHandler implements DiagnosticsModeHandler {
  constructor(private showDetailedDiagnostics:(path: string) => void, private showSummaryDiagnostics:(path: string) => void) {}

  coverageReady(): void {
    this.openTextDocument();
  }
  initialDiagnosticMode(): DiagnosticsMode {
    return DiagnosticsMode.Summary;
  }
  openTextDocument(): void {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }
    this.showDetailedDiagnostics(activeTextEditor.document.uri.fsPath);
  }
  closeTextDocument(): void {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }
    this.showSummaryDiagnostics(activeTextEditor.document.uri.fsPath);
  }
  changeActiveEditor(): void {}
}

class ActiveDocumentsDetailDiagnosticsHandler implements DiagnosticsModeHandler {
  private lastActiveDoc: string;

  constructor(private showDetailedDiagnostics:(path: string) => void, private showSummaryDiagnostics:(path: string) => void) {
    this.lastActiveDoc = "";
  }

  coverageReady(): void {
    this.openTextDocument();
  }
  initialDiagnosticMode(): DiagnosticsMode {
    return DiagnosticsMode.Summary;
  }
  openTextDocument(): void {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }
    if (this.lastActiveDoc !== "") {
      this.showSummaryDiagnostics(this.lastActiveDoc);
    }
    this.lastActiveDoc = activeTextEditor.document.uri.fsPath
    this.showDetailedDiagnostics(this.lastActiveDoc);
  }
  closeTextDocument(): void {
    if (this.lastActiveDoc !== "") {
      this.showSummaryDiagnostics(this.lastActiveDoc);
    }
    this.lastActiveDoc = "";
  }

  changeActiveEditor(): void {
    const activeTextEditor = window.activeTextEditor;
    if (!activeTextEditor) {
      return;
    }
    if (this.lastActiveDoc !== "") {
      this.showSummaryDiagnostics(this.lastActiveDoc);
    }
    this.lastActiveDoc = activeTextEditor.document.uri.fsPath;
    this.showDetailedDiagnostics(this.lastActiveDoc);
  }
}
