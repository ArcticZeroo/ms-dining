import React from 'react';

export const NavVisibilityContext = React.createContext<[boolean, (value: boolean) => void]>([
    true,
    () => void 0
]);