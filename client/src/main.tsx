import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { DiningHallClient } from './api/dining.ts';
import { DiningHallPage } from './components/pages/menu/dining-hall-page.tsx';
import { SettingsPage } from './components/settings/settings-page.tsx';
import { NotFoundPage } from './components/pages/not-found/not-found-page.tsx';
import { SearchPage } from './components/pages/search/search-page.tsx';
import { HomePage } from './components/pages/home/home-page.tsx';
import { InfoPage } from './components/pages/info/info-page.tsx';
import { AnalyticsPage } from './components/pages/analytics/analytics-page.tsx';
import { ErrorPage } from './components/pages/error/error-page.tsx';

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<App/>} loader={() => DiningHallClient.retrieveDiningHallList()} errorElement={<ErrorPage/>}>
            <Route path="/menu/:id" element={<DiningHallPage/>}/>
            <Route path="/settings" element={<SettingsPage/>}/>
            <Route path="/search" element={<SearchPage/>}/>
            <Route path="/info" element={<InfoPage/>}/>
            <Route path="/analytics" element={<AnalyticsPage/>}/>
            <Route index={true} element={<HomePage/>}/>
            <Route path="*" element={<NotFoundPage/>}/>
        </Route>
    )
);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>,
);