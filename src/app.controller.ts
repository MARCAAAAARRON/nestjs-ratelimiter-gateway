import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return 'NestJS Rate Limiter Gateway — try: GET /gateway/ping with an x-api-key header';
  }
}
