import { useContext, useEffect, useState } from 'react';
import { ApplicationContext } from '../context/app.ts';
import { IDiningHall } from '../models/dining-halls.ts';

export const useDiningHalls = () => {
    const { diningHallsById, diningHallIdsInOrder } = useContext(ApplicationContext);
    const [diningHalls, setDiningHalls] = useState<IDiningHall[]>([]);

    useEffect(() => {
        setDiningHalls(diningHallIdsInOrder.map(id => diningHallsById.get(id)!));
    }, [diningHallsById, diningHallIdsInOrder]);

    return diningHalls;
};