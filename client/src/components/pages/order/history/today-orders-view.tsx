import { OrderHistoryView } from './order-history-view.tsx';

export const TodayOrdersView = () => (
    <OrderHistoryView
        title="Your Orders Today"
        pageDescription="Completed orders from today"
        defaultSince="today"
        showFilters={false}
        showHistoryLink={true}
    />
);