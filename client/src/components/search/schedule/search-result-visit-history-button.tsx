import React from 'react';
import { SearchEntityType } from '@msdining/common/dist/models/search.ts';
import { SearchResultVisitHistory } from './search-result-visit-history.tsx';
import { Modal } from '../../popup/modal.tsx';
import { usePopupOpener } from '../../../hooks/popup.ts';

const MODAL_ID = Symbol();

interface ISearchResultVisitHistoryProps {
    entityType: SearchEntityType;
    name: string;
}

export const SearchResultVisitHistoryButton: React.FC<ISearchResultVisitHistoryProps> = ({ entityType, name }) => {
    const openPopup = usePopupOpener();

    const openSchedule = () => {
        openPopup({
            id: MODAL_ID,
            body: (
                <Modal
                    title={`Visit history for "${name}"`}
                    body={<SearchResultVisitHistory entityType={entityType} name={name}/>}
                />
            ),
        });
    };

    return (
        <button
            className="search-result-schedule-button flex flex-center default-container"
            onClick={openSchedule}
            title={`Click to view visit history for "${name}"`}>
            <span className="material-symbols-outlined">
                schedule
            </span>
        </button>
    );
};