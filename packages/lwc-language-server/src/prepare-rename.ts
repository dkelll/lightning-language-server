import { Range, TextDocument } from 'vscode-languageserver';
import { LanguageService, TokenType } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';

/**
 * Prepare rename for an @api property in a JS file.
 * Returns the word range and placeholder if the cursor is on a renameable @api property.
 */
export const prepareRenameJs = (doc: TextDocument, offset: number, componentIndexer: ComponentIndexer): { range: Range; placeholder: string } | null => {
    const tag = componentIndexer.findTagByURI(doc.uri);
    if (!tag) {
        return null;
    }
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
        return null;
    }
    const member = tag.metadata.classMembers?.find((m) => m.name === word);
    if (member?.decorator !== 'api') {
        return null;
    }
    return { range: Range.create(doc.positionAt(start), doc.positionAt(end)), placeholder: word };
};

/**
 * Prepare rename for a tag name or attribute in an HTML template.
 * Scans to find the token under cursor and validates it's renameable.
 */
export const prepareRenameHtml = (
    doc: TextDocument,
    offset: number,
    languageService: LanguageService,
    componentIndexer: ComponentIndexer,
): { range: Range; placeholder: string } | null => {
    const scanner = languageService.createScanner(doc.getText());
    let token: TokenType;
    let currentTag = '';

    do {
        token = scanner.scan();
        if (token === TokenType.StartTag || token === TokenType.EndTag) {
            currentTag = scanner.getTokenText();
        }
        if (offset >= scanner.getTokenOffset() && offset <= scanner.getTokenEnd()) {
            if (token === TokenType.StartTag || token === TokenType.EndTag) {
                if (!componentIndexer.findTagByName(currentTag)) {
                    return null;
                }
                return {
                    range: Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    placeholder: currentTag,
                };
            }
            if (token === TokenType.AttributeName) {
                const attrName = scanner.getTokenText();
                return {
                    range: Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    placeholder: attrName,
                };
            }
            break;
        }
    } while (token !== TokenType.EOS);

    return null;
};
