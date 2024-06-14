import { ApplicationSettings } from "../constants/settings.ts";
import { useValueNotifier } from "./events.ts";
import { ApplicationContext } from "../context/app.ts";
import { useContext, useMemo } from "react";
import { isViewVisible } from "../util/view.ts";

export const useAllowedSearchViewIds = () => {
    const { viewsById } = useContext(ApplicationContext);
    const allowedViewIds = useValueNotifier(ApplicationSettings.searchAllowedViewIds);
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);
    
    return useMemo(
        () => {
            if (allowedViewIds.size === 0) {
                return new Set<string>();
            }
            
            const visibleIds = new Set<string>();
            for (const viewId of allowedViewIds) {
                const view = viewsById.get(viewId);
                if (isViewVisible(view, shouldUseGroups)) {
                    visibleIds.add(viewId);
                }
            }

            return allowedViewIds;
        },
        [allowedViewIds, shouldUseGroups, viewsById]
    );
}