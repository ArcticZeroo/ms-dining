import React from 'react';
import { useSearchResultFields } from '../../hooks/search-result.ts';
import { ISearchResultField } from '../../models/search.ts';

interface ISearchResultExtraFieldsProps {
    extraFields: ISearchResultField[];
    isCompact: boolean;
    matchedModifiers: Map<string, Set<string>>;
}

export const SearchResultExtraFields: React.FC<ISearchResultExtraFieldsProps> = ({
    extraFields,
    isCompact,
    matchedModifiers,
}) => {
    const fields = useSearchResultFields({
        extraFields,
        isCompact,
        matchedModifiers,
    });

    if (fields.length === 0) {
        return null;
    }

    return (
        <div className="search-result-fields">
            {
                fields.map(field => (
                    field.value && (
                        <div className="search-result-field" key={field.key}>
                            <span className="material-symbols-outlined icon">
                                {field.iconName}
                            </span>
                            <span className="value">
                                {field.value}
                            </span>
                        </div>
                    )
                ))
            }
        </div>
    );
};
