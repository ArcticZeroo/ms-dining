import { ISearchExplanation } from '@msdining/common/models/search';
import React from 'react';
import { Signal } from './signal.tsx';
import { formatNumber, similarityFromDistance } from './explain-format.ts';

interface IExplainSummaryProps {
    explanation: ISearchExplanation;
}

export const ExplainSummary: React.FC<IExplainSummaryProps> = ({ explanation }) => (
    <div className="card explain-summary flex flex-wrap">
        <Signal label="Query">{explanation.query}</Signal>
        <Signal label="Normalized">{explanation.normalizedQuery}</Signal>
        <Signal label="Vector top-K size" tip="Number of nearest-neighbor entities retrieved for the query (across items, stations, etc.). Inclusion in this set is the de-facto cosine cutoff.">
            {explanation.vectorTopKSize}
        </Signal>
        <Signal label="Top-K cutoff similarity" tip="Cosine similarity of the least-similar entity still inside the top-K. An item below this is not retrieved by vector search. Can be negative (range -1..1) when even the cutoff entity is unrelated to the query.">
            {formatNumber(similarityFromDistance(explanation.worstIncludedDistance))}
        </Signal>
        <Signal label="Window" tip="The menu dates considered. Empty date = the whole current week (matching a normal search); a chosen date = that single day.">
            {explanation.date ?? 'current week'}
        </Signal>
        <Signal label="Allow no-appearance" tip="Whether vector matches that aren't on any menu in the window can still be returned. True for a whole-week search, false when a specific date is pinned.">
            {explanation.allowResultsWithoutAppearances ? 'yes' : 'no'}
        </Signal>
    </div>
);
