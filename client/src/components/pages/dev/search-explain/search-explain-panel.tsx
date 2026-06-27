import { ISearchExplanation, ISearchExplanationItem, SearchEntityType } from '@msdining/common/models/search';
import React, { useState } from 'react';
import { useExplainSearchMutation } from '../../../../store/queries/search-explain.ts';
import { useAutocompleteSuggestionsQuery } from '../../../../store/queries/search.ts';
import { useDebouncedValue } from '../../../../hooks/debounce.ts';
import { classNames } from '../../../../util/react.ts';
import { getErrorMessage } from '../../../../util/mutation.ts';
import './search-explain.css';

const formatNumber = (value: number | null, digits = 3): string =>
    value == null ? 'n/a' : value.toFixed(digits);

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="explain-info" tabIndex={0} title={text} aria-label={text}>?</span>
);

const Signal: React.FC<{ label: string; tip?: string; children: React.ReactNode }> = ({ label, tip, children }) => (
    <div className="explain-signal flex-col">
        <span className="explain-signal-label">
            {label}{tip && <> <InfoTip text={tip}/></>}
        </span>
        <span className="explain-signal-value">{children}</span>
    </div>
);

const ItemNameInput: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const [isFocused, setIsFocused] = useState(false);
    const debouncedQuery = useDebouncedValue(value.trim(), 200);
    const { data: suggestions } = useAutocompleteSuggestionsQuery(debouncedQuery);

    // The explain tool resolves menu items, so only suggest those.
    const menuItemSuggestions = (suggestions ?? []).filter(suggestion => suggestion.entityType === SearchEntityType.menuItem);
    const showDropdown = isFocused && menuItemSuggestions.length > 0 && value.trim().length > 0;

    return (
        <div className="explain-autocomplete-wrapper flex-grow">
            <input
                type="text"
                placeholder="Item name (e.g. Quesabirria Tacos)"
                value={value}
                onChange={event => onChange(event.target.value)}
                onFocus={() => setIsFocused(true)}
                // Delay so a click on a suggestion registers before the dropdown hides.
                onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            />
            {
                showDropdown && (
                    <div className="explain-autocomplete-dropdown card">
                        {
                            menuItemSuggestions.slice(0, 8).map(suggestion => (
                                <button
                                    type="button"
                                    key={suggestion.name}
                                    className="explain-autocomplete-item"
                                    onMouseDown={event => event.preventDefault()}
                                    onClick={() => {
                                        onChange(suggestion.name);
                                        setIsFocused(false);
                                    }}
                                >
                                    {suggestion.name}
                                </button>
                            ))
                        }
                    </div>
                )
            }
        </div>
    );
};

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
            <Signal label="Cosine similarity" tip="How semantically close the query is to this item, from -1 (opposite) to 1 (identical). Embeddings are usually positive; near 0 means unrelated.">{formatNumber(item.cosineSimilarity)}</Signal>
            <Signal label="Cosine distance">{formatNumber(item.cosineDistance)}</Signal>
            <Signal label="Vector rank" tip="This item's position among the query's nearest neighbors. Only the top 50 are retrieved by vector search.">{item.vectorRank == null ? '—' : `#${item.vectorRank}`}</Signal>
            <Signal label="In vector top-K">{item.isInVectorTopK ? 'yes' : 'no'}</Signal>
            <Signal label="Has embedding">{item.hasEmbedding ? 'yes' : 'no'}</Signal>
            <Signal label="Text match" tip="Which fields the query matched as a fuzzy subsequence: title, description, tags, search tags, or modifiers.">{item.nameMatchReasons.length > 0 ? item.nameMatchReasons.join(', ') : 'none'}</Signal>
            <Signal label="Substring match">{item.isExactSubstringMatch ? 'yes' : 'no'}</Signal>
            <Signal label="On menu (window)" tip="Whether this item appears on a menu in the search window (whole current week, or the chosen date).">{item.appearsInSearchWindow ? `yes (${item.appearances.length})` : 'no'}</Signal>
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
            <Signal label="Vector top-K size" tip="Number of nearest-neighbor entities retrieved for the query (across items, stations, etc.). Inclusion in this set is the de-facto cosine cutoff.">{explanation.vectorTopKSize}</Signal>
            <Signal label="Top-K cutoff similarity" tip="Cosine similarity of the least-similar entity still inside the top-K. An item below this is not retrieved by vector search. Can be negative (range -1..1) when even the cutoff entity is unrelated to the query.">
                {explanation.worstIncludedDistance == null ? 'n/a' : formatNumber(1 - explanation.worstIncludedDistance)}
            </Signal>
            <Signal label="Window" tip="The menu dates considered. Empty date = the whole current week (matching a normal search); a chosen date = that single day.">{explanation.date ?? 'current week'}</Signal>
            <Signal label="Allow no-appearance" tip="Whether vector matches that aren't on any menu in the window can still be returned. True for a whole-week search, false when a specific date is pinned.">{explanation.allowResultsWithoutAppearances ? 'yes' : 'no'}</Signal>
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
                vector top-K, cosine distance, text-match, and menu-appearance logic. Currently covers
                menu items only.
            </div>

            <form className="flex flex-wrap search-explain-form" onSubmit={onSubmit}>
                <input
                    type="text"
                    className="flex-grow"
                    placeholder="Search query (e.g. birria)"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                />
                <ItemNameInput value={itemName} onChange={setItemName}/>
                <input
                    type="date"
                    title="Optional: scope to a single date. Leave empty to search the whole current week, like a normal search."
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

            <div className="explain-hint subtitle">
                Leave the date empty to match a normal search (the whole current week). Pick a date to
                scope to that single day.
            </div>

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
