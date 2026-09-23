import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ControleurApplication } from './app.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
  ],
  controllers: [ControleurApplication],
})
export class ModuleApplication {}
