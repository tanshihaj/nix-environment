import * as vscode from 'vscode';
import * as commands from './commands';
import * as common from './common';

export function activate(context: vscode.ExtensionContext): void {
	const state = new common.ExtensionState(context);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			commands.enable,
			(fromActivation?: boolean) => commands.enableHandler(state, fromActivation)
		),
		vscode.commands.registerCommand(
			commands.disable,
			() => commands.disableHandler(state)
		),
		vscode.commands.registerCommand(
			commands.clear,
			() => commands.clearHandler(state)
		),
		vscode.commands.registerCommand(
			commands.reload,
			() => commands.reloadHandler(state)
		),
		vscode.commands.registerCommand(
			commands.selectEnvironmentFile,
			() => commands.selectEnvironmentFileHandler(state)
		),
		state.statusBarItem
	);

	if (!state.enabled) {
		state.outputChannel.appendLine("extension disabled, will not do anything");
		common.updateStatusBar(state);
	} else {
		vscode.commands.executeCommand(commands.enable, true);
	}
}

export function deactivate() {}
