import { DocumentSymbol, SymbolKind, Range, Position, TextDocument } from 'vscode-languageserver';
import { HTMLDocument, Node } from 'vscode-html-languageservice';
import { compileDocument } from './javascript/compiler';
import { ClassMember } from '@salesforce/lightning-lsp-common';

const memberRange = (loc: ClassMember['loc']): Range => {
    if (!loc) {
        return Range.create(0, 0, 0, 0);
    }
    return Range.create(Position.create(loc.start.line - 1, loc.start.column), Position.create(loc.end.line - 1, loc.end.column));
};

const memberSymbolKind = (member: ClassMember): SymbolKind => {
    if (member.type === 'method') {
        return SymbolKind.Method;
    }
    if (member.decorator === 'wire') {
        return SymbolKind.Event;
    }
    return SymbolKind.Property;
};

export const getJsDocumentSymbols = (document: TextDocument): DocumentSymbol[] => {
    const { metadata } = compileDocument(document);
    if (!metadata?.classMembers) {
        return [];
    }

    const children: DocumentSymbol[] = metadata.classMembers.map((member) => ({
        name: member.name,
        detail: member.decorator ? `@${member.decorator}` : '',
        kind: memberSymbolKind(member),
        range: memberRange(member.loc),
        selectionRange: memberRange(member.loc),
    }));

    const classRange = metadata.declarationLoc ? memberRange(metadata.declarationLoc) : Range.create(0, 0, document.lineCount - 1, 0);

    return [
        {
            name: document.uri.split('/').pop()?.replace(/\.js$/, '') || 'default',
            kind: SymbolKind.Class,
            range: classRange,
            selectionRange: classRange,
            children,
        },
    ];
};

const htmlNodeSymbolKind = (tag: string): SymbolKind => {
    if (tag === 'template') {
        return SymbolKind.Module;
    }
    if (tag === 'slot') {
        return SymbolKind.Interface;
    }
    if (tag.includes('-')) {
        return SymbolKind.Class;
    }
    return SymbolKind.Field;
};

const htmlNodeToSymbol = (node: Node, document: TextDocument): DocumentSymbol | null => {
    if (!node.tag) {
        return null;
    }

    const range = Range.create(document.positionAt(node.start), document.positionAt(node.end));
    const selectionRange = Range.create(document.positionAt(node.start), document.positionAt(node.startTagEnd ?? node.end));

    const children: DocumentSymbol[] = (node.children || []).map((child) => htmlNodeToSymbol(child, document)).filter(Boolean);

    return {
        name: node.tag,
        kind: htmlNodeSymbolKind(node.tag),
        range,
        selectionRange,
        children,
    };
};

export const getHtmlDocumentSymbols = (document: TextDocument, htmlDocument: HTMLDocument): DocumentSymbol[] =>
    htmlDocument.roots.map((root) => htmlNodeToSymbol(root, document)).filter(Boolean);
