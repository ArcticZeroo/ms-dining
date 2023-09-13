import { Outlet, useLoaderData } from 'react-router-dom';
import { IDiningHall } from './models/dining-halls.ts';
import { DiningHallList } from './components/dining-halls/dining-hall-list.tsx';

function App() {
    const diningHallList = useLoaderData() as Array<IDiningHall>;
    return (
        <div className="App">
            <div className="sidebar">
                <DiningHallList diningHalls={diningHallList}/>
            </div>
            <div className="menu">
                <Outlet/>
            </div>
        </div>
    )
}

export default App
