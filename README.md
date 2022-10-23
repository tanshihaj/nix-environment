# Nix environment applier

Extension to evaluate `*.nix` file and apply dev environment to Visual Studio Code.


## How to use

1. Make sure that `nix` command from [nix package manager](https://nixos.org/nix/) available in you system.
2. Build `*.vsix` using `npm run vsix` in this repo.
3. [Install .vsix in Visual Studio Code](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix).
4. In Visual Studio Code's Command Pallette (<kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>) run `Nix environment: select *.nix file` and select required `*.nix` file.
5. After `*.nix` file evaluation extension will offer you window reload to apply environment.


## Settings

| Setting                            | Description                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `nix-environment.enabled`          | Enable or disable extension: show status bar widget & apply environment             |
| `nix-environment.environment-file` | `*.nix` file that describes dev environment to apply. Path is relative to workspace |


## Commands

| Setting                                   | Description                                             |
| ----------------------------------------- | ------------------------------------------------------- |
| `nix-environment.enable`                  | Enable extension and show widget in status bar          |
| `nix-environment.disable`                 | Disable extension and hide widget in status bar         |
| `nix-environment.clear`                   | Clear applied environment                               |
| `nix-environment.reload`                  | Reevaluate applied `*.nix` file and reapply environment |
| `nix-environment.select-environment-file` | Select `*.nix`, evaluate it and apply environment       |


## Similar extensions

- https://github.com/arrterian/nix-env-selector. I've used arrterian's extension before writing this one. There is some differences:
  - My extension uses `nix print-dev-env --json -f default.nix` (while arrterian use `nix-shell default.nix --run env`) which is more reliable way to get dev environment from file.
  - There is output channel with extension actions to better understand what happen inside extension and better debug issues.
  - My extension have cool Nix logo in status bar!

## Known issues

### Environment applying

Main issue is the applying environment variables to Visual Studio Code's host extension process. Currently this is done by changing `process.env`. Thus it is required to run this extension's `activate()` function before other extension's `activate()` functions. I have to use `*` activation event to do so and it works. Most of the times. This approach is obviously fragile and should be replaced with API from this issue https://github.com/microsoft/vscode/issues/152806 as soon as this feature will be implemented.