import { CodeAction, CodeActionKind, Diagnostic, Position, Range, TextDocument, TextEdit, WorkspaceEdit } from 'vscode-languageserver';

const LWC1102_PATTERN = /LWC1102: Invalid '(\w+)' decorator usage/;
const LWC_IMPORT_PATTERN = /import\s*\{([^}]+)\}\s*from\s*['"]lwc['"]/;

const extractDecoratorName = (diagnostic: Diagnostic): string | null => {
    const match = LWC1102_PATTERN.exec(diagnostic.message);
    return match ? match[1] : null;
};

const buildImportEdit = (document: TextDocument, decoratorName: string): TextEdit => {
    const text = document.getText();
    const importMatch = LWC_IMPORT_PATTERN.exec(text);

    if (importMatch) {
        // Existing lwc import — add the specifier
        const specifiers = importMatch[1];
        const newSpecifiers = specifiers.trimEnd() + ', ' + decoratorName;
        const importStart = text.indexOf(importMatch[0]);
        const specStart = importStart + importMatch[0].indexOf(importMatch[1]);
        return TextEdit.replace(Range.create(document.positionAt(specStart), document.positionAt(specStart + importMatch[1].length)), newSpecifiers);
    }

    // No lwc import — add a new import line at the top
    return TextEdit.insert(Position.create(0, 0), `import { ${decoratorName} } from 'lwc';\n`);
};

export const getCodeActions = (document: TextDocument, diagnostics: Diagnostic[]): CodeAction[] => {
    const actions: CodeAction[] = [];

    for (const diagnostic of diagnostics) {
        if (diagnostic.source !== 'lwc') {
            continue;
        }
        const decoratorName = extractDecoratorName(diagnostic);
        if (!decoratorName) {
            continue;
        }

        const edit = buildImportEdit(document, decoratorName);
        const changes: WorkspaceEdit = { changes: { [document.uri]: [edit] } };

        actions.push({
            title: `Import '${decoratorName}' from 'lwc'`,
            kind: CodeActionKind.QuickFix,
            diagnostics: [diagnostic],
            edit: changes,
        });
    }

    return actions;
};
