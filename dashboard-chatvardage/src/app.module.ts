import { Module } from '@nestjs/common';

import { ControleurApplication } from './app.controller.js';

// Le .env est charge par dotenv au debut de main.ts.
@Module({
  controllers: [ControleurApplication],
})
export class ModuleApplication {}
