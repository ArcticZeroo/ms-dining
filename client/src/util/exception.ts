const ERROR_TEXT = 'Menus are currently updating, please try again later.';

export class MenusCurrentlyUpdatingException extends Error {
    constructor() {
        super(ERROR_TEXT);
    }

    static getText(exception: unknown, defaultMessage: string, menusUpdatingErrorMessage = ERROR_TEXT) {
        return (exception instanceof MenusCurrentlyUpdatingException)
            ? menusUpdatingErrorMessage
            : defaultMessage;
    }
}