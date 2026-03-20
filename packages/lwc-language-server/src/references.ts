import { Location, Range, TextDocument } from 'vscode-languageserver';
import { LanguageService, TokenType } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import { Tag, getLwcName, getClassMemberLocation } from './tag';
import { paramCase } from 'change-case';
import * as path from 'path';
import * as fs from 'fs';
import { URI } from 'vscode-uri';

interface HtmlAttrOccurrence {
    uri: string;
    range: Range;
}

/**
 * Scan an HTML template for occurrences of a given tag name and/or attribute.
 */
const scanHtmlForTagAttribute = (
    htmlText: string,
    uri: string,
    languageService: LanguageService,
    targetTag: string,
    targetAttr?: string,
): HtmlAttrOccurrence[] => {
    const results: HtmlAttrOccurrence[] = [];
    const doc = TextDocument.create(uri, 'html', 1, htmlText);
    const scanner = languageService.createScanner(htmlText);
    let token: TokenType;
    let currentTag = '';
    let inTargetTag = false;

    do {
        token = scanner.scan();
        switch (token) {
            case TokenType.StartTag:
                currentTag = scanner.getTokenText();
                inTargetTag = currentTag === targetTag;
                if (inTargetTag && !targetAttr) {
                    results.push({
                        uri,
                        range: Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    });
                }
                break;
            case TokenType.AttributeName:
                if (inTargetTag && targetAttr && scanner.getTokenText() === targetAttr) {
                    results.push({
                        uri,
                        range: Range.create(doc.positionAt(scanner.getTokenOffset()), doc.positionAt(scanner.getTokenEnd())),
                    });
                }
                break;
        }
    } while (token !== TokenType.EOS);

    return results;
};

const getHtmlFilePath = (tag: Tag): string | null => {
    const htmlPath = tag.file.replace(/\.js$/, '.html');
    return fs.existsSync(htmlPath) ? htmlPath : null;
};

/**
 * Find all HTML templates that reference a component's @api property as a kebab-case attribute.
 */
export const findApiPropertyReferences = (componentIndexer: ComponentIndexer, languageService: LanguageService, tag: Tag, memberName: string): Location[] => {
    const lwcTagName = getLwcName(tag);
    const kebabAttr = paramCase(memberName);
    const locations: Location[] = [];

    for (const otherTag of componentIndexer.customData) {
        const htmlPath = getHtmlFilePath(otherTag);
        if (!htmlPath) {
            continue;
        }
        const htmlUri = URI.file(path.resolve(htmlPath)).toString();
        const htmlText = fs.readFileSync(htmlPath, 'utf-8');
        const occurrences = scanHtmlForTagAttribute(htmlText, htmlUri, languageService, lwcTagName, kebabAttr);
        for (const occ of occurrences) {
            locations.push(Location.create(occ.uri, occ.range));
        }
    }

    return locations;
};

/**
 * Find all HTML templates that use a given component tag.
 */
export const findComponentTagReferences = (componentIndexer: ComponentIndexer, languageService: LanguageService, tagName: string): Location[] => {
    const locations: Location[] = [];

    for (const otherTag of componentIndexer.customData) {
        const htmlPath = getHtmlFilePath(otherTag);
        if (!htmlPath) {
            continue;
        }
        const htmlUri = URI.file(path.resolve(htmlPath)).toString();
        const htmlText = fs.readFileSync(htmlPath, 'utf-8');
        const occurrences = scanHtmlForTagAttribute(htmlText, htmlUri, languageService, tagName);
        for (const occ of occurrences) {
            locations.push(Location.create(occ.uri, occ.range));
        }
    }

    return locations;
};

/**
 * Find the JS property/method definition for a {binding} used in an HTML template.
 */
export const findBindingDefinitionInJs = (componentIndexer: ComponentIndexer, uri: string, bindingName: string): Location | null => {
    const tag = componentIndexer.findTagByURI(uri);
    if (!tag) {
        return null;
    }
    return getClassMemberLocation(tag, bindingName);
};
