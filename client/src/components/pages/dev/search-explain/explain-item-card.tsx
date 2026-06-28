import { ISearchExplanationItem } from '@msdining/common/models/search';
import React from 'react';
import { classNames } from '../../../../util/react.ts';
import { Signal } from './signal.tsx';
import { ExplainAppearances } from './explain-appearances.tsx';
import { formatNumber } from './explain-format.ts';

interface IExplainItemCardProps {
    item: ISearchExplanationItem;
}

export const ExplainItemCard: React.FC<IExplainItemCardProps> = ({ item }) => (
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
            <Signal label="Cosine similarity" tip="How semantically close the query is to this specific menu-item instance, from -1 (opposite) to 1 (identical). Embeddings are usually positive; near 0 means unrelated.">{formatNumber(item.cosineSimilarity)}</Signal>
            <Signal label="Cosine distance">{formatNumber(item.cosineDistance)}</Signal>
            <Signal label="Rank similarity" tip="Vector results are de-duped to distinct dishes by entityKey, so the rank is set by the closest cross-cafe instance of this dish. This is that instance's cosine similarity — it equals the cosine similarity above when this exact item is the closest one.">{formatNumber(item.representativeCosineSimilarity)}</Signal>
            <Signal label="Vector rank" tip="This dish's position among the query's nearest neighbors, after de-duping to distinct dishes (by entityKey) and ranking each by its closest cross-cafe instance. Only the top 50 distinct dishes are retrieved.">{item.vectorRank == null ? '—' : `#${item.vectorRank}`}</Signal>
            <Signal label="In vector top-K">{item.isInVectorTopK ? 'yes' : 'no'}</Signal>
            <Signal label="Has embedding">{item.hasEmbedding ? 'yes' : 'no'}</Signal>
            <Signal label="Text match" tip="Which fields the query matched as a fuzzy subsequence: title, description, tags, search tags, or modifiers.">{item.nameMatchReasons.length > 0 ? item.nameMatchReasons.join(', ') : 'none'}</Signal>
            <Signal label="Substring match">{item.isExactSubstringMatch ? 'yes' : 'no'}</Signal>
            <Signal label="On menu (window)" tip="Whether this item appears on a menu in the search window (whole current week, or the chosen date).">{item.appearsInSearchWindow ? `yes (${item.appearances.length})` : 'no'}</Signal>
            <Signal label="isVectorMatch">{item.isVectorMatch ? 'yes' : 'no'}</Signal>
            <Signal label="Would register">{item.wouldRegisterAsMatch ? 'yes' : 'no'}</Signal>
        </div>

        <ExplainAppearances appearances={item.appearances}/>
    </div>
);
