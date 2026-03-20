import { SymbolInformation, SymbolKind } from 'vscode-languageserver';
import ComponentIndexer from './component-indexer';
import { getLwcName, getTagUri, getTagRange, getClassMembers } from './tag';
import { toVSCodeRange } from './javascript/compiler';

/**
 * Return workspace symbols matching the query string.
 * Exposes each LWC component as a Class symbol, with @api properties/methods as children.
 */
export const getWorkspaceSymbols = (componentIndexer: ComponentIndexer, query: string): SymbolInformation[] => {
    const lowerQuery = query.toLowerCase();
    const results: SymbolInformation[] = [];

    for (const tag of componentIndexer.customData) {
        const tagName = getLwcName(tag);
        const uri = getTagUri(tag);
        const tagMatches = !query || tagName.toLowerCase().includes(lowerQuery);

        if (tagMatches) {
            results.push(SymbolInformation.create(tagName, SymbolKind.Class, getTagRange(tag), uri));
        }

        for (const member of getClassMembers(tag)) {
            if (!member.decorator) {
                continue;
            }
            const memberMatches = !query || member.name.toLowerCase().includes(lowerQuery);
            if (tagMatches || memberMatches) {
                const kind = member.type === 'method' ? SymbolKind.Method : SymbolKind.Property;
                const range = member.loc ? toVSCodeRange(member.loc) : getTagRange(tag);
                results.push(SymbolInformation.create(member.name, kind, range, uri, tagName));
            }
        }
    }

    return results;
};
