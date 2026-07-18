import { All, Controller, Get, UseGuards, Body, Post, Req, Res, UseFilters } from '@nestjs/common';
import type { Request, Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';
import { RatelimiterService } from './ratelimiter.service';
import { RatelimiterGuard } from './ratelimiter.guard';
import { CreateKeyLimitDto } from './dto/create-key-limit.dto';
import { RateLimitExceededFilter } from './rate-limit-exceeded.filters';

@Controller('gateway')
export class RatelimiterController {
  constructor(
    private readonly rateLimiterService: RatelimiterService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @UseGuards(RatelimiterGuard)
  @UseFilters(RateLimitExceededFilter)
  @Get('ping')
  getPing() {
    return { status: 'ok' };
  }

  @Post('admin/keys')
  registerKey(@Body() dto: CreateKeyLimitDto) {
    this.rateLimiterService.setLimit(dto.apiKey, dto.limitPerWindow);
    return { received: dto };
  }

  @All('proxy/*')
  @UseGuards(RatelimiterGuard)
  async proxy(@Req() req: Request, @Res() res: Response) {
    const backendUrl = this.configService.get<string>('BACKEND_URL', 'http://localhost:4000');
    const forwardPath = req.url.replace('/gateway/proxy', '');
    const targetUrl = `${backendUrl}${forwardPath}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method,
          url: targetUrl,
          data: req.body,
        }),
      );
      res.status(response.status).json(response.data);
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        res.status(error.response?.status ?? 502).json({
          message: 'Backend request failed',
          error: error.message,
        });
      } else {
        res.status(500).json({
          message: 'Unexpected error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
}