import { classNames } from '../../util/react.ts';
import starIcon from '../../assets/icons/filled/star-white.svg';

interface IHomepageCafesFilterButtonProps {
    isActive: boolean;
    onClick: () => void;
}

export const HomepageCafesFilterButton = ({ isActive, onClick }: IHomepageCafesFilterButtonProps) => (
    <button
        type="button"
        className={classNames('default-container flex flex-center default-button grey', isActive && 'active')}
        onClick={onClick}
        title={isActive ? 'Showing only your homepage cafes' : 'Filter to your homepage cafes'}
    >
        <img src={starIcon} alt="" className="icon-sized"/>
        My Cafes
    </button>
);
