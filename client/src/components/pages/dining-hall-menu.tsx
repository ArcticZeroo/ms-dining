import React, { Suspense } from 'react';
import { Await, useLoaderData } from 'react-router-dom';
import { isDuckType } from '@arcticzeroo/typeguard';
import { ErrorCard } from '../card/error.tsx';
import { ConceptList } from '../dining-halls/concept/concept-list.tsx';
import { IConceptLoaderData } from '../../models/router.ts';

export const DiningHallMenu: React.FC = () => {
    const data = useLoaderData();

    if (!isDuckType<IConceptLoaderData>(data, {
        concepts: 'object'
    })) {
        return (
            <div>
                Unable to load menu!
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="loading">Loading menu...</div>}>
            <Await resolve={data.concepts} errorElement={<ErrorCard>Failed to load menu!</ErrorCard>}>
                <ConceptList/>
            </Await>
        </Suspense>
    );
};