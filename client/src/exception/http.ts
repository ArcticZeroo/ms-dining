export class HttpException extends Error {
    constructor(public readonly statusCode: number) {
        super(`Response failed with statusCode: ${statusCode}`);
    }
}