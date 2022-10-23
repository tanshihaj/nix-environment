import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import * as consts from './consts';
import * as commands from './commands';
import { isDevEnv } from './nix_output';

export class ExtensionState {
	public context: vscode.ExtensionContext;
	public outputChannel: vscode.OutputChannel;
	public statusBarItem: vscode.StatusBarItem;
	public originalPathEnv: string|undefined;

	public applied: boolean;
	public pendingWindowReload: boolean;
	public lastEvaluationFinishedWithError: boolean;

	private _enabled: boolean;
    get enabled(): boolean {
        return this._enabled;
    }
    set enabled(value: boolean) {
		vscode.workspace.getConfiguration(consts.extensionId).update('enabled', value);
        this._enabled = value;
    }

	private _environmentFile: string|undefined;
    get environmentFile(): string|undefined {
        return this._environmentFile;
    }
    set environmentFile(value: string|undefined) {
		vscode.workspace.getConfiguration(consts.extensionId).update('environment-file', value);
        this._environmentFile = value;
    }

	constructor (context: vscode.ExtensionContext) {
		const config = vscode.workspace.getConfiguration(consts.extensionId);
		this.context = context;
		this.outputChannel = vscode.window.createOutputChannel(consts.extensionName);
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBarItem.command = commands.selectEnvironmentFile;
		this.originalPathEnv = process.env.PATH;

		this.applied = false;
		this.pendingWindowReload = false;
		this.lastEvaluationFinishedWithError = false;

		const enabled = config.get<boolean>('enabled');
		this._enabled = enabled === undefined ? true : enabled;
		this._environmentFile = config.get<string>('environment-file');
	}
}

export function updateStatusBar(state: ExtensionState): void {
	if (!state.enabled) {
		state.statusBarItem.hide();
		return;
	}

	if (state.lastEvaluationFinishedWithError) {
		state.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
	} else if (state.pendingWindowReload) {
		state.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	} else {
		state.statusBarItem.backgroundColor = undefined;
	}

	if (state.environmentFile) {
		const selectedFileRel = vscode.workspace.asRelativePath(state.environmentFile);
		if (state.applied) {
			if (state.pendingWindowReload) {
				state.statusBarItem.text = `$(distro-nix) ${selectedFileRel}`;
				state.statusBarItem.tooltip = `Environment loaded from ${state.environmentFile}, reloaded required to apply changes`;
			} else {
				state.statusBarItem.text = `$(distro-nix) ${selectedFileRel}`;
				state.statusBarItem.tooltip = `Environment loaded from ${state.environmentFile}`;
			}
		} else {
			if (state.lastEvaluationFinishedWithError) {
				state.statusBarItem.text = `$(distro-nix) $(alert) ${selectedFileRel}`;
				state.statusBarItem.tooltip = `Error loading ${state.environmentFile} file`;
			} else {
				state.statusBarItem.text = `$(distro-nix) $(sync~spin) ${selectedFileRel}`;
				state.statusBarItem.tooltip = `Loading environment from ${state.environmentFile}`;
			}
		}
	} else {
		state.statusBarItem.text = `$(distro-nix) file not selected`;
		state.statusBarItem.tooltip = `Click to select *.nix environment file`;
	}

	state.statusBarItem.show();
}

export function getEnvironmentFileFromConfigSync(state: ExtensionState): vscode.Uri|undefined {
	const environmentFile = state.environmentFile;
	if (environmentFile === undefined || environmentFile === '') {
		return undefined;
	}
	if (vscode.workspace.workspaceFolders === undefined) {
		state.outputChannel.appendLine(`found ${environmentFile} in configs, but no workspace opened`);
		return undefined;
	}
	const environmentFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, environmentFile);
	if (!fs.existsSync(environmentFilePath)) {
		state.outputChannel.appendLine(`found ${environmentFile} in configs, but file ${environmentFilePath} does not exits`);
		return undefined;
	}
	return vscode.Uri.parse(environmentFilePath);
}

export async function maybeSuggestEnvironmentFile(state: ExtensionState): Promise<void> {
	const bestCandidate = await findBestEnvironmentFileCandidate(state);
	if (bestCandidate === undefined) {
		return;
	}

	updateStatusBar(state);

	const bestCandidateRelativePath = vscode.workspace.asRelativePath(bestCandidate);

	const message = `There is ${bestCandidateRelativePath}, do you want to use it as environment file?`;
	const actions : vscode.MessageItem[] = [
		{
			title: "Yes"
		},
		{
			title: "Select other file"
		},
		{
			title: "No",
			isCloseAffordance: true
		}
	];
	const triggered = await vscode.window.showInformationMessage(message, ...actions);
	if (triggered === undefined) {
		state.outputChannel.appendLine("user closed environment select dialog, do nothing");
		return;
	}
	if (triggered.title === "Yes") {
		state.outputChannel.appendLine(`user selected ${bestCandidate.fsPath}`);
		loadEnvironmentSync(state, bestCandidate.fsPath);
	} else if (triggered.title === "No") {
		state.outputChannel.appendLine(`user say no to environment select, disabling module for this workspace`);
		vscode.commands.executeCommand(commands.disable);
	} else if (triggered.title === "Select other file") {
		state.outputChannel.appendLine(`user want to select other file`);
		vscode.commands.executeCommand(commands.selectEnvironmentFile);
	}
}

export async function suggestReloadMessage(state: ExtensionState, applied: boolean) {
	const actions : vscode.MessageItem[] = [
		{
			title: "Reload"
		},
		{
			title: "Cancel",
			isCloseAffordance: true
		}
	];
	const triggered = await vscode.window.showInformationMessage(
		applied ? `To apply nix environment window should be reloaded` :
			`To clear nix environment window should be reloaded`,
		...actions,
	);
	if (triggered === undefined) {
		state.outputChannel.appendLine("user closed windows reload dialog, do nothing");
		return;
	}
	if (triggered.title === "Reload") {
		state.outputChannel.appendLine(`reloading windows`);
		vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
}

export async function findAllEnvironmentFileCandidates(state: ExtensionState) : Promise<vscode.Uri[]|undefined> {
	if (vscode.workspace.workspaceFolders === undefined) {
		state.outputChannel.appendLine("no workspaces opened");
		return undefined;
	}

	return await vscode.workspace.findFiles('*.nix');
}

export async function findBestEnvironmentFileCandidate(state: ExtensionState) : Promise<vscode.Uri|undefined> {
	const candidates = await findAllEnvironmentFileCandidates(state);
	if (candidates === undefined || candidates.length === 0) {
		state.outputChannel.appendLine("cannot find nix environment file candidates");
		return undefined;
	}

	const maybeShellNix = candidates.find(e => path.basename(e.fsPath) === "shell.nix");
	if (maybeShellNix) {
		return maybeShellNix;
	}

	const maybeDefaultNix = candidates.find(e => path.basename(e.fsPath) === "default.nix");
	if (maybeDefaultNix) {
		return maybeDefaultNix;
	}

	return candidates[0];
}

export function loadEnvironmentSync(state: ExtensionState, selectedFile: string, fromActivation?: boolean) : void {
	state.applied = false;

	const args = [
		'--extra-experimental-features', 'nix-command',
		'print-dev-env',
		'--impure',
		'--json',
		'-f', selectedFile,
	];
	const cmd = `nix ${args.join(' ')}`;
	state.outputChannel.appendLine(`launching '${cmd}'`);
	state.environmentFile = vscode.workspace.asRelativePath(selectedFile);
	updateStatusBar(state);

	let devEnvRaw: string;
	try {
		devEnvRaw = cp.execFileSync('nix', args, { encoding: 'utf-8' });
	} catch (err) {
		state.outputChannel.appendLine(`${err}`);
		state.lastEvaluationFinishedWithError = true;
		updateStatusBar(state);

		const message = `nix environment evaluation finished with error`;
		const actions : vscode.MessageItem[] = [
			{
				title: "Show error"
			}
		];
		vscode.window.showErrorMessage(message, ...actions)
			.then(function(value: vscode.MessageItem | undefined): void { state.outputChannel.show(); });
		return;
	}
	
	const devEnv = JSON.parse(devEnvRaw);
	if (!isDevEnv(devEnv)) {
		console.log("error");
		// todo: popup
		return;
	}

	state.outputChannel.appendLine(`applying environment variables`);
	for (const [envName, envValue] of Object.entries(devEnv.variables)) {
		if (envValue.type !== "exported") {
			continue;
		}
		if (
			envName === 'HOME' 
			|| envName === 'SHELL'
			|| envName === 'TEMP'
			|| envName === 'TEMPDIR'
			|| envName === 'TMP'
			|| envName === 'TMPDIR'
		) {
			continue;
		}
		if (envName === 'PATH') {
			process.env[envName] = envValue.value + (state.originalPathEnv ? (':' + state.originalPathEnv) : '');
		} else {
			process.env[envName] = envValue.value;
		}
		state.context.environmentVariableCollection.replace(envName, envValue.value);
	}

	state.outputChannel.appendLine(`done`);
	state.lastEvaluationFinishedWithError = false;
	state.pendingWindowReload = (fromActivation === undefined);
	state.applied = true;
	updateStatusBar(state);

	if (state.pendingWindowReload) {
		suggestReloadMessage(state, true);
	}

	// todo: follow file changes and suggest reload
}
