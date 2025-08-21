import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
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
import { checkMigrationCookie, doMigrationAndRedirectToDiningSite } from './util/migration.ts';
import { ProfilePage } from './components/pages/profile/profile-page.tsx';
import { LoginPage } from './components/pages/login/login-page.tsx';
import { removeSourceQueryParamIfNeeded } from './util/telemetry.ts';
import { App } from './components/app.tsx';
import './index.css';
import { DevPage } from './components/pages/dev/dev-page.js';

const startApp = () => {
    const router = createBrowserRouter(
        createRoutesFromElements(
            <Route path="/" element={<App/>} errorElement={<ErrorPage/>}>
                <Route path="/menu/:id" element={<CafeViewPage/>}/>
                <Route path="/settings" element={<SettingsPage/>}/>
                <Route path="/search" element={<SearchPage/>}/>
                <Route path="/cheap" element={<CheapItemsPage/>}/>
                <Route path="/info" element={<InfoPage/>}/>
                <Route path="/order" element={<OrderPage/>}/>
                <Route path="/analytics" element={<AnalyticsPage/>}/>
                <Route path="/location-test" element={<LocationTestPage/>}/>
                <Route path="/profile" element={<ProfilePage/>}/>
                <Route path="/login" element={<LoginPage/>}/>
                <Route path="/dev" element={<DevPage/>}/>
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
};

if (window.location.hostname === 'msdining.frozor.io') {
    doMigrationAndRedirectToDiningSite();
} else {
    checkMigrationCookie();
    removeSourceQueryParamIfNeeded();
    startApp();
}