import { randomSortInPlace } from '../../../../util/random.ts';
import { useMemo, useState } from 'react';
import { TabView } from '../../../view/tab-view.js';
import { SearchIdeasResults } from './search-ideas-results.js';
import './search-ideas.css';

const SEARCH_IDEAS = [
    'burger',
    'burrito',
    'dessert',
    'fried rice',
    'gyro',
    'latte',
    // 'mango lassi', - only one result
    'milk tea',
    'pasta',
    'sushi',
    'vegetarian',
    'curry',
    'pizza',
    'fruit',
    'chicken tenders',
    'fish',
    'croissant'
];

const MAX_IDEA_COUNT = 6;

export const SearchIdeas = () => {
    const ideas = useMemo(
        () => randomSortInPlace([...SEARCH_IDEAS]).slice(0, MAX_IDEA_COUNT),
        []
    );

    if (ideas.length === 0) {
        throw new Error('No ideas.');
    }

    const [selectedIdea, setSelectedIdea] = useState(ideas[0]!);

    const tabOptions = useMemo(() => ideas.map(idea => ({
        name: idea,
        id: idea
    })), [ideas]);

    return (
        <TabView
            options={tabOptions}
            selectedTabId={selectedIdea}
            onTabIdChanged={setSelectedIdea}
            renderTab={() => <SearchIdeasResults searchQuery={selectedIdea}/> }
        />
    );
};