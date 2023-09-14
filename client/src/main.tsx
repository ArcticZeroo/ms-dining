import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { createBrowserRouter, createRoutesFromElements, defer, Route, RouterProvider } from 'react-router-dom';
import { DiningHallClient } from './api/dining.ts';
import { DiningHallMenu } from './components/pages/dining-hall-menu.tsx';
import { SettingsPage } from './components/settings/settings-page.tsx';
import { NotFoundPage } from './components/pages/not-found.tsx';

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<App/>} loader={() => DiningHallClient.retrieveDiningHallList()} errorElement={<NotFoundPage/>}>
            <Route path="/menu/:id" element={<DiningHallMenu/>} loader={async (ctx) => {
                const id = ctx.params.id;

                if (!id) {
                    return null
                }

                return defer({
                    concepts: DiningHallClient.retrieveDiningHallMenu(id)
                });
            }}/>
            <Route path="/settings" element={<SettingsPage/>}/>
        </Route>
    )
);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>,
);