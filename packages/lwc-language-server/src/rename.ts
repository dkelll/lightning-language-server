import { TextEdit, WorkspaceEdit } from 'vscode-languageserver';
import { LanguageService } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import { Tag, getLwcName, findClassMember, getClassMemberLocation } from './tag';
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
 * Rename an @api property from JS: update JS definition + all HTML attribute usages.
 */
export const renameApiProperty = (
    componentIndexer: ComponentIndexer,
    languageService: LanguageService,
    tag: Tag,
    oldName: string,
    newCamelName: string,
): WorkspaceEdit | null => {
    const jsLoc = getClassMemberLocation(tag, oldName);
    if (!jsLoc) {
        return null;
    }
    const changes = collectHtmlEdits(componentIndexer, languageService, getLwcName(tag), paramCase(newCamelName), paramCase(oldName));
    changes[jsLoc.uri] = [TextEdit.replace(jsLoc.range, newCamelName)];
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
