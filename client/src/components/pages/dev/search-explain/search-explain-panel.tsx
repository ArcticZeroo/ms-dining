import { ISearchExplanation, ISearchExplanationItem } from '@msdining/common/models/search';
import React, { useState } from 'react';
import { useExplainSearchMutation } from '../../../../store/queries/search-explain.ts';
import { classNames } from '../../../../util/react.ts';
import { getErrorMessage } from '../../../../util/mutation.ts';
import './search-explain.css';

const formatNumber = (value: number | null, digits = 3): string =>
    value == null ? 'n/a' : value.toFixed(digits);

const Signal: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="explain-signal flex-col">
        <span className="explain-signal-label">{label}</span>
        <span className="explain-signal-value">{children}</span>
    </div>
);

const ExplainItemCard: React.FC<{ item: ISearchExplanationItem }> = ({ item }) => (
    <div className={classNames('card explain-item flex-col', item.isInFinalResults ? 'matched' : 'not-matched')}>
        <div className="flex flex-between">
            <div className="flex-col">
                <span className="explain-item-name">{item.name}</span>
                <span className="explain-item-sub">{item.cafeId} · station {item.stationId} · {item.menuItemId}</span>
            </div>
            <span className={classNames('explain-verdict', item.isInFinalResults ? 'matched' : 'not-matched')}>
                {item.isInFinalResults ? '✅ Matched' : '❌ Not matched'}
            </span>
        </div>

        <ul className="explain-reasons">
            {item.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
        </ul>

        <div className="explain-signals flex flex-wrap">
            <Signal label="Cosine similarity">{formatNumber(item.cosineSimilarity)}</Signal>
            <Signal label="Cosine distance">{formatNumber(item.cosineDistance)}</Signal>
            <Signal label="Vector rank">{item.vectorRank == null ? '—' : `#${item.vectorRank}`}</Signal>
            <Signal label="In vector top-K">{item.isInVectorTopK ? 'yes' : 'no'}</Signal>
            <Signal label="Has embedding">{item.hasEmbedding ? 'yes' : 'no'}</Signal>
            <Signal label="Text match">{item.nameMatchReasons.length > 0 ? item.nameMatchReasons.join(', ') : 'none'}</Signal>
            <Signal label="Substring match">{item.isExactSubstringMatch ? 'yes' : 'no'}</Signal>
            <Signal label="On menu (window)">{item.appearsInSearchWindow ? `yes (${item.appearances.length})` : 'no'}</Signal>
            <Signal label="isVectorMatch">{item.isVectorMatch ? 'yes' : 'no'}</Signal>
            <Signal label="Would register">{item.wouldRegisterAsMatch ? 'yes' : 'no'}</Signal>
        </div>

        {
            item.appearances.length > 0 && (
                <details className="explain-appearances">
                    <summary>Appearances ({item.appearances.length})</summary>
                    <ul>
                        {item.appearances.map((appearance, index) => (
                            <li key={index}>{appearance.dateString} · {appearance.cafeId} · {appearance.stationName}</li>
                        ))}
                    </ul>
                </details>
            )
        }
    </div>
);

const ExplainResult: React.FC<{ explanation: ISearchExplanation }> = ({ explanation }) => (
    <div className="flex-col">
        <div className="card explain-summary flex flex-wrap">
            <Signal label="Query">{explanation.query}</Signal>
            <Signal label="Normalized">{explanation.normalizedQuery}</Signal>
            <Signal label="Vector top-K size">{explanation.vectorTopKSize}</Signal>
            <Signal label="Top-K cutoff similarity">
                {explanation.worstIncludedDistance == null ? 'n/a' : formatNumber(1 - explanation.worstIncludedDistance)}
            </Signal>
            <Signal label="Window">{explanation.date ?? 'current week'}</Signal>
            <Signal label="Allow no-appearance">{explanation.allowResultsWithoutAppearances ? 'yes' : 'no'}</Signal>
        </div>

        {
            explanation.items.length === 0
                ? <div className="card error">No menu item found for that name. Try a different name or an exact menu item id.</div>
                : explanation.items.map(item => <ExplainItemCard key={item.menuItemId} item={item}/>)
        }

        <details className="card explain-nearest">
            <summary>Nearest menu items for this query ({explanation.nearestMenuItems.length})</summary>
            <table className="explain-nearest-table">
                <thead>
                    <tr><th>Rank</th><th>Name</th><th>Distance</th><th>Similarity</th></tr>
                </thead>
                <tbody>
                    {explanation.nearestMenuItems.map(nearest => (
                        <tr key={nearest.menuItemId}>
                            <td>#{nearest.rank}</td>
                            <td>{nearest.name ?? nearest.menuItemId}</td>
                            <td>{formatNumber(nearest.distance)}</td>
                            <td>{formatNumber(1 - nearest.distance)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </details>
    </div>
);

export const SearchExplainPanel = () => {
    const [query, setQuery] = useState('');
    const [itemName, setItemName] = useState('');
    const [date, setDate] = useState('');
    const explainMutation = useExplainSearchMutation();

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!query.trim() || !itemName.trim()) {
            return;
        }
        explainMutation.mutate({
            query: query.trim(),
            name:  itemName.trim(),
            date:  date.trim() || undefined,
        });
    };

    return (
        <div className="flex-col search-explain">
            <div className="subtitle">
                Explain why a menu item did or did not match a search query. Reuses the live search
                vector top-K, cosine distance, text-match, and menu-appearance logic.
            </div>

            <form className="flex flex-wrap search-explain-form" onSubmit={onSubmit}>
                <input
                    type="text"
                    placeholder="Search query (e.g. birria)"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
                <input
                    type="text"
                    placeholder="Item name (e.g. Quesabirria Tacos)"
                    value={itemName}
                    onChange={event => setItemName(event.target.value)}
                />
                <input
                    type="date"
                    title="Optional: scope to a single date instead of the current week"
                    value={date}
                    onChange={event => setDate(event.target.value)}
                />
                <button
                    type="submit"
                    className="default-button default-container"
                    disabled={explainMutation.isPending || !query.trim() || !itemName.trim()}
                >
                    {explainMutation.isPending ? 'Explaining…' : 'Explain'}
                </button>
            </form>

            {
                explainMutation.isError && (
                    <div className="card error">
                        {getErrorMessage(explainMutation.error, 'Failed to explain search')}
                    </div>
                )
            }

            {
                explainMutation.data && <ExplainResult explanation={explainMutation.data}/>
            }
        </div>
    );
};
