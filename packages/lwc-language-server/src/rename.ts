import { TextEdit, Range, WorkspaceEdit } from 'vscode-languageserver';
import { LanguageService } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import { Tag, getLwcName, findClassMember, getTagUri } from './tag';
import { scanHtmlForTagAttribute, getHtmlFilePath } from './references';
import { paramCase } from 'change-case';
import camelcase from 'camelcase';
import * as path from 'path';
import * as fs from 'fs';
import { URI } from 'vscode-uri';

const collectHtmlEdits = (
    componentIndexer: ComponentIndexer,
    languageService: LanguageService,
    tagName: string,
    newText: string,
    attrName?: string,
): { [uri: string]: TextEdit[] } => {
    const changes: { [uri: string]: TextEdit[] } = {};
    for (const tag of componentIndexer.customData) {
        const htmlPath = getHtmlFilePath(tag);
        if (!htmlPath) {
            continue;
        }
        const htmlUri = URI.file(path.resolve(htmlPath)).toString();
        const htmlText = fs.readFileSync(htmlPath, 'utf-8');
        const occurrences = scanHtmlForTagAttribute(htmlText, htmlUri, languageService, tagName, attrName);
        if (occurrences.length > 0) {
            changes[htmlUri] = occurrences.map((occ) => TextEdit.replace(occ.range, newText));
        }
    }
    return changes;
};

/**
 * Find the range of just the property name within a class member's loc.
 * The loc covers the full declaration (e.g. "@api myProp = 'val'"), so we
 * search for the name within that text to get a precise range.
 */
const findNameRange = (tag: Tag, memberName: string): { uri: string; range: Range } | null => {
    const member = findClassMember(tag, memberName);
    if (!member?.loc) {
        return null;
    }
    const jsPath = tag.file;
    const source = fs.readFileSync(jsPath, 'utf-8');
    const lines = source.split('\n');
    // loc is 1-based line, 0-based column
    const startLine = member.loc.start.line - 1;
    const startCol = member.loc.start.column;
    const endLine = member.loc.end.line - 1;
    // Extract the text covered by the member loc
    const memberLines = lines.slice(startLine, endLine + 1);
    memberLines[0] = memberLines[0].substring(startCol);
    const memberText = memberLines.join('\n');
    const nameIdx = memberText.indexOf(memberName);
    if (nameIdx < 0) {
        return null;
    }
    // Convert back to absolute position
    let line = startLine;
    let col = startCol + nameIdx;
    // Account for newlines in memberText before nameIdx
    const before = memberText.substring(0, nameIdx);
    const newlines = before.split('\n').length - 1;
    if (newlines > 0) {
        line = startLine + newlines;
        col = before.length - before.lastIndexOf('\n') - 1;
    }
    const uri = getTagUri(tag);
    return { uri, range: Range.create(line, col, line, col + memberName.length) };
};

/**
 * Rename an @api property from JS: update JS definition + all HTML attribute usages.
 */
export const renameApiProperty = (
    componentIndexer: ComponentIndexer,
    languageService: LanguageService,
    tag: Tag,
    oldName: string,
    newCamelName: string,
): WorkspaceEdit | null => {
    const nameRange = findNameRange(tag, oldName);
    if (!nameRange) {
        return null;
    }
    const changes = collectHtmlEdits(componentIndexer, languageService, getLwcName(tag), paramCase(newCamelName), paramCase(oldName));
    changes[nameRange.uri] = [TextEdit.replace(nameRange.range, newCamelName)];
    return { changes };
};

/**
 * Rename an HTML attribute on a custom component: update JS @api property + all HTML usages.
 */
export const renameHtmlAttribute = (
    componentIndexer: ComponentIndexer,
    languageService: LanguageService,
    tagName: string,
    oldAttr: string,
    newKebabName: string,
): WorkspaceEdit | null => {
    const tag = componentIndexer.findTagByName(tagName);
    if (!tag) {
        return null;
    }
    const camelOld = camelcase(oldAttr);
    const member = findClassMember(tag, camelOld);
    if (!member || member.decorator !== 'api') {
        return null;
    }
    return renameApiProperty(componentIndexer, languageService, tag, camelOld, camelcase(newKebabName));
};

/**
 * Rename a component tag across all HTML templates.
 */
export const renameComponentTag = (
    componentIndexer: ComponentIndexer,
    languageService: LanguageService,
    oldTagName: string,
    newTagName: string,
): WorkspaceEdit | null => {
    const changes = collectHtmlEdits(componentIndexer, languageService, oldTagName, newTagName);
    if (Object.keys(changes).length === 0) {
        return null;
    }
    return { changes };
};
