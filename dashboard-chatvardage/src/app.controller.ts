/* eslint-disable class-methods-use-this */
import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ControleurApplication {
  @Get()
  @Redirect('/administration', 302)
  // NestJS invokes this handler as an instance method without instance state.
  redirigerVersAdministration(): void {

  }
}
