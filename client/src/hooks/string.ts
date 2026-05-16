import { useSelectedDate } from "../store/zustand/selected-date.ts";

export const useTitleWithSelectedDate = (text: string) => {
    const selectedDate = useSelectedDate();
    return `${text} on ${selectedDate.toLocaleDateString()}`;
}