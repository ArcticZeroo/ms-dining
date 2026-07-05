import React from 'react';
import { IMenuItem } from '@msdining/common/models/cafe';
import { MenuItem } from './menu-items/menu-item.tsx';

interface ICourseMenuSectionProps {
    title: string;
    subtitle?: string;
    items: IMenuItem[];
}

export const CourseMenuSection: React.FC<ICourseMenuSectionProps> = ({ title, subtitle, items }) => {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="ingredients-course-section">
            <div className="ingredients-course-header">
                <h3 className="ingredients-course-title">{title}</h3>
                {subtitle && <span className="ingredients-course-subtitle">{subtitle}</span>}
            </div>
            <div className="menu-category-items">
                {items.map(item => (
                    <MenuItem key={item.id} menuItem={item}/>
                ))}
            </div>
        </div>
    );
};
