export const toDateString = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
export const fromDateString = (dateString: string) => new Date(`${dateString}T00:00`);