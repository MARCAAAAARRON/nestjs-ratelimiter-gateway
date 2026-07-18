import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RatelimiterModule } from './ratelimiter/ratelimiter.module';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true, }), RatelimiterModule, PrometheusModule.register({
    path: '/metrics',
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
