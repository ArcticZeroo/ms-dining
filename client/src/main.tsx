import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import { DiningClient } from './api/dining.ts';
import { MapTestPage } from './components/pages/map-test/map-test-page.tsx';
import { CafeViewPage } from './components/pages/menu/cafe-view-page.tsx';
import { SettingsPage } from './components/pages/settings/settings-page.tsx';
import { NotFoundPage } from './components/pages/not-found/not-found-page.tsx';
import { SearchPage } from './components/pages/search/search-page.tsx';
import { HomePage } from './components/pages/home/home-page.tsx';
import { InfoPage } from './components/pages/info/info-page.tsx';
import { AnalyticsPage } from './components/pages/analytics/analytics-page.tsx';
import { ErrorPage } from './components/pages/error/error-page.tsx';
import { CheapItemsPage } from './components/pages/cheap/cheap-items-page.tsx';
import { OrderPage } from './components/pages/order/order-page.tsx';
import { LocationTestPage } from './components/pages/location-test/location-test-page.tsx';

import './index.css';

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path="/" element={<App/>} loader={() => DiningClient.retrieveViewList()} errorElement={<ErrorPage/>}>
            <Route path="/menu/:id" element={<CafeViewPage/>}/>
            <Route path="/settings" element={<SettingsPage/>}/>
            <Route path="/search" element={<SearchPage/>}/>
            <Route path="/cheap" element={<CheapItemsPage/>}/>
            <Route path="/info" element={<InfoPage/>}/>
            <Route path="/order" element={<OrderPage/>}/>
            <Route path="/analytics" element={<AnalyticsPage/>}/>
            <Route path="/location-test" element={<LocationTestPage/>}/>
            <Route path="/map-test" element={<MapTestPage/>}/>
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