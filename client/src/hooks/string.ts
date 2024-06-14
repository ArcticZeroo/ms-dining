import { useValueNotifierContext } from "./events.ts";
import { SelectedDateContext } from "../context/time.ts";

export const useTitleWithSelectedDate = (text: string) => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    return `${text} on ${selectedDate.toLocaleDateString()}`;
}