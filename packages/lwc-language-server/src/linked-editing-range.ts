import { Range, TextDocument } from 'vscode-languageserver';
import { LanguageService, TokenType } from 'vscode-html-languageservice';

interface TagOccurrence {
    name: string;
    start: number;
    end: number;
    isClose: boolean;
}

/**
 * Given a cursor position on an HTML tag name, return the ranges of both
 * the opening and closing tag names so they can be edited simultaneously.
 */
export const getLinkedEditingRanges = (doc: TextDocument, languageService: LanguageService, offset: number): Range[] | null => {
    const text = doc.getText();
    const scanner = languageService.createScanner(text);
    const tags: TagOccurrence[] = [];
    let cursorTag: TagOccurrence | null = null;
    let token: TokenType;

    // Collect all tag occurrences and find which one the cursor is on
    do {
        token = scanner.scan();
        if (token === TokenType.StartTag || token === TokenType.EndTag) {
            const tag: TagOccurrence = {
                name: scanner.getTokenText(),
                start: scanner.getTokenOffset(),
                end: scanner.getTokenEnd(),
                isClose: token === TokenType.EndTag,
            };
            tags.push(tag);
            if (offset >= tag.start && offset <= tag.end) {
                cursorTag = tag;
            }
        }
    } while (token !== TokenType.EOS);

    if (!cursorTag) {
        return null;
    }

    // Find the matching tag using a nesting stack
    if (!cursorTag.isClose) {
        // Cursor is on an opening tag — find matching close tag
        let depth = 0;
        for (const t of tags) {
            if (t.start <= cursorTag.start) {
                continue;
            }
            if (t.name === cursorTag.name) {
                if (!t.isClose) {
                    depth++;
                } else if (depth === 0) {
                    return [
                        Range.create(doc.positionAt(cursorTag.start), doc.positionAt(cursorTag.end)),
                        Range.create(doc.positionAt(t.start), doc.positionAt(t.end)),
                    ];
                } else {
                    depth--;
                }
            }
        }
    } else {
        // Cursor is on a closing tag — find matching open tag
        let depth = 0;
        for (let i = tags.length - 1; i >= 0; i--) {
            const t = tags[i];
            if (t.start >= cursorTag.start) {
                continue;
            }
            if (t.name === cursorTag.name) {
                if (t.isClose) {
                    depth++;
                } else if (depth === 0) {
                    return [
                        Range.create(doc.positionAt(t.start), doc.positionAt(t.end)),
                        Range.create(doc.positionAt(cursorTag.start), doc.positionAt(cursorTag.end)),
                    ];
                } else {
                    depth--;
                }
            }
        }
    }

    return null;
};
