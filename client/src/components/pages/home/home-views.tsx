import { useHomepageViews } from '../../../hooks/views.ts';
import { CombinedCafeMenuList } from '../../cafes/combined-cafe-menu-list.tsx';

export const HomeViews = () => {
    const homepageViews = useHomepageViews();

    if (homepageViews.length === 0) {
        return null;
    }

    return (
        <CombinedCafeMenuList
            views={homepageViews}
            countTowardsLastUsed={false}
            showGroupNames={true}
        />
    );
}