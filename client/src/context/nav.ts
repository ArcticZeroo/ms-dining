import React from 'react';

export const NavExpansionContext = React.createContext<[boolean, (value: boolean) => void]>([
    true,
    () => void 0
]);