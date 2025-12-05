import React, { useMemo, useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '../../types/chat';
import './styles.css';

interface RagSource {
    source: string;
    score: number;
}

interface RagCitationsProps {
    message: Message;
}

/**
 * Parse RAG citations from message metadata.
 * Tool results are stored as: [("local_rag", formatted_string), ...]
 * Format of formatted_string:
 *   **Relevant information from knowledge base:**
 *   ---
 *   [Source: filename.txt] (relevance: 0.85)
 *   content...
 */
function parseRagSources(metadata?: Record<string, unknown>): RagSource[] {
    if (!metadata?.tool_results) return [];

    const toolResults = metadata.tool_results as Array<[string, string]>;
    const sources: RagSource[] = [];

    for (const [toolName, result] of toolResults) {
        if (toolName !== 'local_rag') continue;

        // Parse [Source: xxx] (relevance: 0.xx) patterns
        const sourcePattern = /\[Source:\s*([^\]]+)\]\s*\(relevance:\s*([\d.]+)\)/g;
        let match;
        while ((match = sourcePattern.exec(result)) !== null) {
            sources.push({
                source: match[1].trim(),
                score: parseFloat(match[2]),
            });
        }
    }

    // Remove duplicates by source name
    const uniqueSources = sources.filter(
        (s, i, arr) => arr.findIndex(x => x.source === s.source) === i
    );

    // Sort by relevance score descending
    return uniqueSources.sort((a, b) => b.score - a.score);
}

export const RagCitations: React.FC<RagCitationsProps> = ({ message }) => {
    const [expanded, setExpanded] = useState(false);
    const sources = useMemo(() => parseRagSources(message.metadata), [message.metadata]);

    if (sources.length === 0) return null;

    const displaySources = expanded ? sources : sources.slice(0, 2);
    const hasMore = sources.length > 2;

    return (
        <div className="rag-citations">
            <div className="rag-citations-header">
                <FileText size={12} />
                <span>Sources ({sources.length})</span>
            </div>
            <div className="rag-citations-list">
                {displaySources.map((source, index) => (
                    <div key={index} className="rag-citation-item">
                        <span className="rag-citation-name">{source.source}</span>
                        <span className="rag-citation-score">
                            {(source.score * 100).toFixed(0)}%
                        </span>
                    </div>
                ))}
            </div>
            {hasMore && (
                <button
                    className="rag-citations-toggle"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? (
                        <>
                            <ChevronUp size={12} />
                            <span>Show less</span>
                        </>
                    ) : (
                        <>
                            <ChevronDown size={12} />
                            <span>Show {sources.length - 2} more</span>
                        </>
                    )}
                </button>
            )}
        </div>
    );
};
