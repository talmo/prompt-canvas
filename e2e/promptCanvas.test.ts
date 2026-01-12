import path from 'path';
import { browser, expect } from '@wdio/globals';

describe('Prompt Canvas Extension', () => {
  it('should load VS Code', async () => {
    const workbench = await (browser as any).getWorkbench();
    const title = await workbench.getTitleBar().getTitle();
    expect(title).toContain('Visual Studio Code');
  });

  it('should open a .queue.md file with custom editor', async () => {
    const workbench = await (browser as any).getWorkbench();

    // Open the test fixture file
    const testFile = path.join(process.cwd(), 'src', 'test', 'fixtures', 'basic.queue.md');

    // Use command palette to open file
    await (browser as any).executeWorkbench(async (vscode: any, filePath: string) => {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    }, testFile);

    // Wait for editor to load
    await browser.pause(2000);

    // Get the active editor
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();

    expect(activeTab).toBeDefined();
    const tabTitle = await activeTab?.getTitle();
    expect(tabTitle).toContain('basic.queue.md');
  });

  it('should display prompts in the webview', async () => {
    // Get all webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      // Look for another nested iframe (VS Code webviews are double-nested)
      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Look for prompt content in the webview
      const promptCell = await browser.$('[data-testid="prompt-cell"]');
      await promptCell.waitForExist({ timeout: 5000 });

      expect(await promptCell.isExisting()).toBe(true);

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });

  it('should show status badges for prompts', async () => {
    // Get all webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Look for status badges
      const statusBadge = await browser.$('[data-testid="status-badge"]');
      await statusBadge.waitForExist({ timeout: 5000 });

      expect(await statusBadge.isExisting()).toBe(true);

      // Check the status attribute
      const status = await statusBadge.getAttribute('data-status');
      expect(['queue', 'active', 'done', 'trash']).toContain(status);

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });

  it('should allow editing prompt content', async () => {
    // Get all webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Find a textarea
      const textarea = await browser.$('textarea');
      await textarea.waitForExist({ timeout: 5000 });

      // Get original value
      const originalValue = await textarea.getValue();
      expect(originalValue.length).toBeGreaterThan(0);

      // Click and modify content
      await textarea.click();
      await textarea.clearValue();
      await textarea.setValue('Updated prompt content');

      const newValue = await textarea.getValue();
      expect(newValue).toBe('Updated prompt content');

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });

  it('should toggle group collapse when clicking header', async () => {
    // Open a file with groups
    const testFile = path.join(process.cwd(), 'src', 'test', 'fixtures', 'with-groups.queue.md');

    await (browser as any).executeWorkbench(async (vscode: any, filePath: string) => {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    }, testFile);

    await browser.pause(2000);

    // Get webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Find group header
      const groupHeader = await browser.$('[data-testid="group-header"]');
      if (await groupHeader.isExisting()) {
        const initialCollapsed = await groupHeader.getAttribute('data-collapsed');

        // Click to toggle
        await groupHeader.click();
        await browser.pause(500);

        const newCollapsed = await groupHeader.getAttribute('data-collapsed');

        // Verify state changed
        expect(newCollapsed).not.toBe(initialCollapsed);
      }

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });

  it('should display prompt sets with v1.1 format', async () => {
    // Open a file with sets
    const testFile = path.join(process.cwd(), 'src', 'test', 'fixtures', 'with-sets.queue.md');

    await (browser as any).executeWorkbench(async (vscode: any, filePath: string) => {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    }, testFile);

    await browser.pause(2000);

    // Get webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Find prompt set container
      const promptSet = await browser.$('[data-testid="prompt-set"]');
      await promptSet.waitForExist({ timeout: 5000 });

      expect(await promptSet.isExisting()).toBe(true);

      // Check for active set indicator
      const activeSet = await browser.$('[data-testid="prompt-set"][data-active="true"]');
      expect(await activeSet.isExisting()).toBe(true);

      // Check that set header exists
      const setHeader = await browser.$('[data-testid="set-header"]');
      expect(await setHeader.isExisting()).toBe(true);

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });

  it('should toggle set collapse when clicking set header', async () => {
    // Open a file with sets
    const testFile = path.join(process.cwd(), 'src', 'test', 'fixtures', 'with-sets.queue.md');

    await (browser as any).executeWorkbench(async (vscode: any, filePath: string) => {
      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.open', uri);
    }, testFile);

    await browser.pause(2000);

    // Get webview frames
    const webviewFrame = await browser.$('iframe.webview.ready');
    if (await webviewFrame.isExisting()) {
      await browser.switchToFrame(webviewFrame);

      const innerFrame = await browser.$('iframe');
      if (await innerFrame.isExisting()) {
        await browser.switchToFrame(innerFrame);
      }

      // Find set header
      const setHeader = await browser.$('[data-testid="set-header"]');
      if (await setHeader.isExisting()) {
        const initialCollapsed = await setHeader.getAttribute('data-collapsed');

        // Click to toggle
        await setHeader.click();
        await browser.pause(500);

        const newCollapsed = await setHeader.getAttribute('data-collapsed');

        // Verify state changed
        expect(newCollapsed).not.toBe(initialCollapsed);
      }

      // Switch back to main context
      await browser.switchToParentFrame();
      await browser.switchToParentFrame();
    }
  });
});
