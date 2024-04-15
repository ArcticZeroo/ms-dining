import { ExpandIcon } from '../icon/expand.tsx';
import { FavoriteItemButtonSkeleton } from './favorite-item-button-skeleton.tsx';

export const StationSkeleton = () => (
    <div className="station loading-skeleton">
        <div className="station-header flex-row">
            <FavoriteItemButtonSkeleton/>
            <button className="title" disabled={true}>
				...
                <ExpandIcon isExpanded={true}/>
            </button>
        </div>
        <div className="menu-body">
			...
        </div>
    </div>
);