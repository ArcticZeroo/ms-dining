import React from 'react';

export const classNames = (...classNames: Array<string | false | undefined | null>) => classNames.filter(Boolean).join(' ');

export const repeatComponent = (count: number, createComponent: (i: number) => React.ReactNode) => {
    const components: React.ReactNode[] = [];
    for (let i = 0; i < count; i++) {
        components.push(createComponent(i));
    }
    return components;
}