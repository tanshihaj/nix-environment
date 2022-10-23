import * as vscode from 'vscode';
import * as path from 'path';

import * as common from './common';

export const enable: string = "nix-environment.enable";
export async function enableHandler(state: common.ExtensionState, fromActivation?: boolean) : Promise<void> {
	state.outputChannel.appendLine(`enabling extension`);
	state.enabled = true;
	state.outputChannel.appendLine(`searching for nix environment file...`);

	const environmentFilePath = common.getEnvironmentFileFromConfigSync(state);
	if (environmentFilePath !== undefined) {
		state.outputChannel.appendLine(`found ${environmentFilePath.fsPath} in configs`);
		common.loadEnvironmentSync(state, environmentFilePath.fsPath, fromActivation);
	} else {
		common.maybeSuggestEnvironmentFile(state);
	}
}

export const disable: string = "nix-environment.disable";
export async function disableHandler(state: common.ExtensionState) : Promise<void> {
	state.outputChannel.appendLine(`disabling extension`);
	state.enabled = false;
	state.pendingWindowReload = state.applied;
	common.updateStatusBar(state);

	if (state.applied) {
		common.suggestReloadMessage(state, false);
	}
}

export const clear: string = "nix-environment.clear";
export async function clearHandler(state: common.ExtensionState) : Promise<void> {
	state.outputChannel.appendLine(`clearing environment`);
	state.pendingWindowReload = state.applied;
	state.environmentFile = undefined;
	common.updateStatusBar(state);

	if (state.applied) {
		common.suggestReloadMessage(state, false);
	}
}

export const reload: string = "nix-environment.reload";
export async function reloadHandler(state: common.ExtensionState) : Promise<void> {
	state.outputChannel.appendLine(`reloading environment`);
	if (state.environmentFile && vscode.workspace.workspaceFolders !== undefined) {
		const environmentFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, state.environmentFile);
		common.loadEnvironmentSync(state, environmentFilePath);
	} else {
		// todo: error no file
	}
}

export const selectEnvironmentFile: string = "nix-environment.select-environment-file";
export async function selectEnvironmentFileHandler(state: common.ExtensionState) : Promise<void> {
	state.outputChannel.appendLine(`showing environment select quick pick`);
	state.enabled = true;
	common.updateStatusBar(state);

	let picks : vscode.QuickPickItem[] = [{
		label: "",
		kind: vscode.QuickPickItemKind.Separator
	}];
	if (state.applied) {
		picks = picks.concat({
			label: "Clear",
			description: "Clear environment",
		});
	}
	picks = picks.concat({
		label: "Disable",
		description: state.applied ? "Clear environment and hide status bar widget" : "Hide status bar widget"
	});

	const candidates = await common.findAllEnvironmentFileCandidates(state);
	if (candidates !== undefined) {
		for (const candidate of candidates) {
			// todo: prepick best file
			const relPath = vscode.workspace.asRelativePath(candidate);
			picks.unshift({
				label: relPath,
				description: (relPath === state.environmentFile && state.applied) ? "reload" : undefined,
			});
		}
		const value = await vscode.window.showQuickPick(
			picks,
			{
				title: 'Select *.nix file to use as environment file'
			}
		);
		if (value !== undefined) {
			state.outputChannel.appendLine(`user picked ${value.label}`);
			if (value.description !== undefined && value.description !== "reload") {
				if (value.label === "Clear") {
					vscode.commands.executeCommand(clear);
				} else if (value.label === "Disable") {
					vscode.commands.executeCommand(disable);
				}
			} else {
				if (vscode.workspace.workspaceFolders === undefined) {
					// todo: error popup
					state.outputChannel.appendLine(`no workspaces opened, cannot open picked ${value}`);
					return;
				}
				const pickedFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, value.label);
				common.loadEnvironmentSync(state, pickedFilePath);
			}
		} else {
			state.outputChannel.appendLine(`user rejected quick pick`);
			common.updateStatusBar(state);	// todo: does we need it?
		}
	} else {
		state.outputChannel.appendLine(`there is no *.nix files in project root`);
		common.updateStatusBar(state);
	}
}