import React, { Suspense } from 'react';
import { Await, useLoaderData } from 'react-router-dom';
import { isDuckType } from '@arcticzeroo/typeguard';
import { ErrorCard } from '../../card/error.tsx';
import { ConceptListOutlet } from './concept-list-outlet.tsx';
import { IConceptLoaderData } from '../../../models/router.ts';

export const DiningHallPage: React.FC = () => {
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
                <ConceptListOutlet/>
            </Await>
        </Suspense>
    );
};