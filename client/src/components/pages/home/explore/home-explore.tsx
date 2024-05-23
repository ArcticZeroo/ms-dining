import { SearchIdeas } from './search-ideas.tsx';

export const HomeExplore = () => {
    return (
        <div className="flex-col default-container">
            <div>
				Explore food on campus
            </div>
            <SearchIdeas/>
        </div>
    );
};