import { DocumentHighlight, DocumentHighlightKind, Range, TextDocument } from 'vscode-languageserver';
import { LanguageService, TokenType } from 'vscode-html-languageservice';

/**
 * Find all occurrences of a tag name in an HTML template.
 * Highlights both start and end tags.
 */
const highlightTag = (doc: TextDocument, languageService: LanguageService, tagName: string): DocumentHighlight[] => {
    const results: DocumentHighlight[] = [];
    const scanner = languageService.createScanner(doc.getText());
    let token: TokenType;
    do {
        token = scanner.scan();
        if ((token === TokenType.StartTag || token === TokenType.EndTag) && scanner.getTokenText() === tagName) {
            results.push(
                DocumentHighlight.create(
                    Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    DocumentHighlightKind.Read,
                ),
            );
        }
    } while (token !== TokenType.EOS);
    return results;
};

/**
 * Find all occurrences of an attribute name within a specific tag in an HTML template.
 */
const highlightAttribute = (doc: TextDocument, languageService: LanguageService, tagName: string, attrName: string): DocumentHighlight[] => {
    const results: DocumentHighlight[] = [];
    const scanner = languageService.createScanner(doc.getText());
    let token: TokenType;
    let currentTag = '';
    do {
        token = scanner.scan();
        if (token === TokenType.StartTag) {
            currentTag = scanner.getTokenText();
        } else if (token === TokenType.AttributeName && currentTag === tagName && scanner.getTokenText() === attrName) {
            results.push(
                DocumentHighlight.create(
                    Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    DocumentHighlightKind.Read,
                ),
            );
        }
    } while (token !== TokenType.EOS);
    return results;
};

/**
 * Find all occurrences of a {binding} expression in an HTML template.
 */
const highlightBinding = (doc: TextDocument, bindingName: string): DocumentHighlight[] => {
    const results: DocumentHighlight[] = [];
    const text = doc.getText();
    const regex = new RegExp(`\\{${bindingName}[.}]`, 'g');
    let match: RegExpExecArray;
    while ((match = regex.exec(text)) !== null) {
        // +1 to skip the opening brace, highlight just the name
        const start = match.index + 1;
        results.push(DocumentHighlight.create(Range.create(doc.positionAt(start), doc.positionAt(start + bindingName.length)), DocumentHighlightKind.Read));
    }
    return results;
};

/**
 * Find all occurrences of a word in a JS document.
 */
export const getJsDocumentHighlights = (doc: TextDocument, offset: number): DocumentHighlight[] => {
    const text = doc.getText();
    let start = offset;
    let end = offset;
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }
    const word = text.substring(start, end);
    if (!word) {
        return [];
    }
    const results: DocumentHighlight[] = [];
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    let match: RegExpExecArray;
    while ((match = regex.exec(text)) !== null) {
        results.push(
            DocumentHighlight.create(Range.create(doc.positionAt(match.index), doc.positionAt(match.index + word.length)), DocumentHighlightKind.Text),
        );
    }
    return results;
};

/**
 * Find all occurrences of the symbol under cursor in an HTML template.
 */
export const getHtmlDocumentHighlights = (
    doc: TextDocument,
    languageService: LanguageService,
    cursorType: string,
    name: string,
    tag?: string,
): DocumentHighlight[] => {
    switch (cursorType) {
        case 'tag':
            return highlightTag(doc, languageService, name);
        case 'attributeKey':
            return highlightAttribute(doc, languageService, tag, name);
        case 'dynamicContent':
        case 'dynamicAttributeValue':
            return highlightBinding(doc, name);
        default:
            return [];
    }
};
