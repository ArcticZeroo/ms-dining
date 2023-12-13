import React from 'react';

export const NavExpansionContext = React.createContext<readonly [boolean, (value: boolean) => void]>([
    true,
    () => void 0
]);