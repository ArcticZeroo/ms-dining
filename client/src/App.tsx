import './App.css'
import { useEffect, useState } from 'react';
import { IDiningHall } from './models/dining-halls.ts';
import { DiningHallClient } from './api/dining.ts';
import { usePromise } from './hooks/async.ts';
import { PromiseStatus } from './models/async.ts';

function App() {
    const [diningHallListPromise, setDiningHallListPromise] = useState<Promise<Array<IDiningHall>>>();
    const diningHallListPromiseState = usePromise(diningHallListPromise);

    useEffect(() => {
        setDiningHallListPromise(DiningHallClient.retrieveDiningHallList());
    }, []);

    if (diningHallListPromiseState.status === PromiseStatus.notStarted) {
        return (
            'Waiting to start...'
        );
    } else if (diningHallListPromiseState.status === PromiseStatus.inProgress) {
        return (
            'Loading...'
        );
    } else {
        const { value, error } = diningHallListPromiseState;
        if (error) {
            return (
                'Could not load dining hall list!'
            );
        } else {
            const diningHalls = value ?? [];
            
        }
    }
}

export default App
