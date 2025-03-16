import React, { useContext } from 'react';
import { SearchEntityType } from '@msdining/common/dist/models/search.ts';
import { PopupContext } from '../../../context/modal.ts';
import { SearchResultVisitHistoryPopupBody } from './search-result-visit-history-popup-body.tsx';
import { Modal } from '../../popup/modal.tsx';

const MODAL_ID = Symbol();

interface ISearchResultVisitHistoryProps {
    entityType: SearchEntityType;
    name: string;
}

export const SearchResultVisitHistoryButton: React.FC<ISearchResultVisitHistoryProps> = ({ entityType, name }) => {
    const modalNotifier = useContext(PopupContext);

    const openSchedule = () => {
        modalNotifier.value = {
            id: MODAL_ID,
            body: (
                <Modal
                    title={`Visit history for "${name}"`}
                    body={<SearchResultVisitHistoryPopupBody entityType={entityType} name={name}/>}
                />
            ),
        };
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