import { HttpException, HttpStatus } from "@nestjs/common";

export class RateLimitExceededException extends HttpException{
    constructor(public readonly retryAfterSeconds: number){
        super('Rate Limit Exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
}