export class MenusCurrentlyUpdatingException extends Error {
    constructor() {
        super('Menus are currently updating, please try again later.');
    }
}