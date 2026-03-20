[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)<br/>
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lwc-language-server?label=lwc-language-server&logo=npm)](https://www.npmjs.com/package/@salesforce/lwc-language-server)
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/aura-language-server?label=aura-language-server&logo=npm)](https://www.npmjs.com/package/@salesforce/aura-language-server)
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lightning-lsp-common?label=lightning-lsp-common&logo=npm)](https://www.npmjs.com/package/@salesforce/lightning-lsp-common)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Lightning Language Servers

Mono repo for the LWC and Aura Language Services — originally built for the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode), now extended with full LSP 3.17 support for Neovim and any LSP-compatible editor.

## Why This Fork Exists

The upstream Salesforce language server was built exclusively for VS Code. It ships with a minimal set of LSP features — just enough to power completions, hover, and go-to-definition inside the Salesforce VS Code extension. Everything else? Left on the table.

This fork changes that. The goal is to unlock the full power of the Language Server Protocol for Salesforce LWC development — especially for developers who live in Neovim. We're talking cross-file rename refactoring, workspace-wide find references, document symbols for Telescope, quick-fix code actions, and more. Every feature that the LSP spec offers and that makes sense for LWC, we're building it.

If you write Lightning Web Components and your editor speaks LSP, this is the language server you want.

## LSP Feature Comparison

| LSP Feature | Salesforce Upstream | This Fork |
|---|:---:|:---:|
| `textDocument/completion` | ✅ | ✅ |
| `completionItem/resolve` | ✅ | ✅ |
| `textDocument/hover` | ✅ | ✅ |
| `textDocument/definition` | ✅ | ✅ |
| `textDocument/documentSymbol` | ❌ | ✅ |
| `textDocument/references` | ❌ | ✅ |
| `textDocument/codeAction` | ❌ | ✅ |
| `textDocument/rename` | ❌ | ✅ |
| `textDocument/documentHighlight` | ❌ | 🔜 |
| `textDocument/linkedEditingRange` | ❌ | 🔜 |
| `workspace/symbol` | ❌ | 🔜 |
| `textDocument/prepareRename` | ❌ | 🔜 |
| `textDocument/signatureHelp` | ❌ | — ¹ |

¹ Covered by `ts_ls` / TypeScript language server running alongside.

### What the new features give you

- **Document Symbols** — `:Telescope lsp_document_symbols` shows your component's `@api` properties, `@wire` services, `@track` state, methods, and full HTML template structure
- **Find References** — cursor on an `@api` property → find every HTML template that uses it as a kebab-case attribute, across the entire workspace
- **Code Actions** — use `@api` without importing it? Quick fix auto-adds `import { api } from 'lwc'` or appends to your existing import
- **Rename** — rename an `@api` property in JS and every HTML template attribute updates automatically (camelCase ↔ kebab-case conversion handled)

## Neovim Usage & Configuration

For developers who want to use this language server in their daily Salesforce LWC workflow — no contribution required, just clone, build, and point your editor at it.

### 1. Clone and Build

```bash
git clone git@github.com:dkelll/lightning-language-server.git
cd lightning-language-server
yarn install
yarn link-lsp
cd packages/lwc-language-server
yarn build
```

### 2. Configure Neovim

The language server binary is at `packages/lwc-language-server/bin/lwc-language-server.js`. Point your LSP config at it with `--stdio`.

#### Lazy.nvim (lazy + nvim-lspconfig)

```lua
-- In your LSP config (e.g. after setting up nvim-lspconfig)
vim.lsp.config("lwc_ls", {
    cmd = {
        "node",
        vim.fn.expand("~/path/to/lightning-language-server/packages/lwc-language-server/bin/lwc-language-server.js"),
        "--stdio",
    },
    init_options = {
        embeddedLanguages = { javascript = true },
    },
})
```

#### Mason.nvim

If you're using Mason, you can override the default `lwc_ls` command to point at your local build instead of the Mason-managed binary:

```lua
-- After mason-lspconfig setup
vim.lsp.config("lwc_ls", {
    cmd = {
        "node",
        vim.fn.expand("~/path/to/lightning-language-server/packages/lwc-language-server/bin/lwc-language-server.js"),
        "--stdio",
    },
    init_options = {
        embeddedLanguages = { javascript = true },
    },
})
```

#### Packer.nvim

```lua
require("lspconfig").lwc_ls.setup({
    cmd = {
        "node",
        vim.fn.expand("~/path/to/lightning-language-server/packages/lwc-language-server/bin/lwc-language-server.js"),
        "--stdio",
    },
    init_options = {
        embeddedLanguages = { javascript = true },
    },
})
```

### 3. Verify

Open an LWC project, then:

```
:checkhealth vim.lsp
```

Look for `lwc_ls` in the output — it should show as attached to your `.js` and `.html` buffers.

### 4. Keybindings & Autocmd Setup

Set up an `LspAttach` autocmd to bind LSP and diagnostic actions only when a language server is active:

```lua
local augroup = vim.api.nvim_create_augroup
local LwcGroup = augroup("LwcLsp", {})

vim.api.nvim_create_autocmd("LspAttach", {
    group = LwcGroup,
    callback = function(e)
        local opts = { buffer = e.buf }

        -- LSP navigation
        vim.keymap.set("n", "gd", vim.lsp.buf.definition, opts)
        vim.keymap.set("n", "K", vim.lsp.buf.hover, opts)

        -- LSP actions (all supported by this fork)
        vim.keymap.set("n", "<leader>vca", vim.lsp.buf.code_action, opts)
        vim.keymap.set("n", "<leader>vrr", vim.lsp.buf.references, opts)
        vim.keymap.set("n", "<leader>vrn", vim.lsp.buf.rename, opts)
        vim.keymap.set("n", "<leader>vws", vim.lsp.buf.workspace_symbol, opts)
        vim.keymap.set("i", "<C-h>", vim.lsp.buf.signature_help, opts)

        -- Diagnostics
        vim.keymap.set("n", "<leader>vd", vim.diagnostic.open_float, opts)
        vim.keymap.set("n", "]e", function() vim.diagnostic.jump({ count = 1 }) end, opts)
        vim.keymap.set("n", "[e", function() vim.diagnostic.jump({ count = -1 }) end, opts)
    end,
})
```

Test it out:

- `:Telescope lsp_document_symbols` — see your component outline
- `<leader>vrr` — find all usages of an `@api` property across templates
- `<leader>vrn` — rename across JS and HTML files
- `<leader>vca` — quick fix missing imports

### 5. Rebuilding After Updates

```bash
cd lightning-language-server/packages/lwc-language-server
git pull
yarn build
```

Then restart the language server in Neovim: `:LspRestart lwc_ls`

## Setup Development Environment (VS Code)

For contributors working on the language server itself using VS Code.

### Clone this repository and Salesforce VSCode Extensions

```
git clone git@github.com:forcedotcom/lightning-language-server.git
git clone git@github.com:forcedotcom/salesforcedx-vscode.git
```

Note: These projects need to be cloned into the same parent directory

### Setup lightning-language-server repository

```
cd lightning-language-server
yarn install
yarn link-lsp
```

### Setup Salesforce VSCode Extensions repository

```
cd ../salesforcedx-vscode
npm install
npm run link-lsp
npm run compile
```

### Open both repositories in a vscode workspace
Note: complete the install process before this step, or you may receive errors about "Property 'objType' does not exist on type 'Node'." from the Tern Server. This is due to the node_modules being improperly installed at a level above the lightning-language-server. If this does happen to you, simply remove the extra node_modules directory.

```
cd ../lightning-language-server
code ./vscode-workspaces/multiroot-simple.code-workspace # or
code ./vscode-workspaces/multiroot-flat.code-workspace
```

The "simple" workspace will effectively show two main nodes in the Explorer, while "flat" will show each package separately.

Simple:

<img src="imgs/workspace-simple.png" width="300">

Flat:

<img src="imgs/workspace-flat.png" width="300">

### Debugging with VSCode

Run 'Launch DX - Aura & LWC' from the VSCode debug view (its the last one in that long list).

### Recompile on change

```
cd ../lightning-language-server
yarn watch
cd ../salesforcedx-vscode
npm run watch
```

Note: You need to restart vscode each time you make changes to the language server or the lightning vscode extensions.
Easiest way to do this is to kill the vscode client and hit F5 to relaunch your debugger.

## Setup Development Environment (Neovim)

For contributors working on the language server itself using Neovim.

### Clone and install

```bash
git clone git@github.com:dkelll/lightning-language-server.git
cd lightning-language-server
yarn install
yarn link-lsp
```

### Build the LWC language server

```bash
cd packages/lwc-language-server
yarn build
```

### Point Neovim at your local build

Configure `lwc_ls` to use your local build (see [Neovim Usage & Configuration](#neovim-usage--configuration) above for your package manager).

### Development workflow

1. Make changes in `packages/lwc-language-server/src/`
2. Rebuild: `cd packages/lwc-language-server && yarn build`
3. Restart the server in Neovim: `:LspRestart lwc_ls`
4. Test your changes in a real LWC project

### Linting

```bash
# From the repo root
npx eslint -c .eslintrc.json packages/lwc-language-server/src/your-file.ts
npx eslint -c .eslintrc.json --fix packages/lwc-language-server/src/your-file.ts
```

### Commit conventions

This repo uses [conventional commits](https://www.conventionalcommits.org/) enforced by commitlint. Format:

```
feat: add textDocument/documentHighlight support
fix: narrow rename edit to property name only
docs: update README with Neovim setup instructions
```
