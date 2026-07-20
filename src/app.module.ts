import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RatelimiterModule } from './ratelimiter/ratelimiter.module';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [ConfigModule.forRoot({isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: __dirname,
    }),
    RatelimiterModule,
    PrometheusModule.register({
    path: '/metrics',
  })],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
