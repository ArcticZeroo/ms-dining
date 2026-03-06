import React from 'react';
import { useBottomSheetDrag } from '../../../hooks/map-bottom-sheet.ts';

interface IMapSidePanelContainerProps {
    children: React.ReactNode;
}

export const MapSidePanelContainer: React.FC<IMapSidePanelContainerProps> = ({ children }) => {
    const { handleRef, panelRef, sheetStyle, isMobile, showHandle } = useBottomSheetDrag();

    return (
        <div className="map-side-panel flex-col" ref={panelRef} style={sheetStyle}>
            {isMobile && showHandle && (
                <div className="bottom-sheet-handle" ref={handleRef}>
                    <div className="bottom-sheet-handle-bar"/>
                </div>
            )}
            {children}
        </div>
    );
};
