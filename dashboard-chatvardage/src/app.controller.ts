import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ControleurApplication {
  // eslint-disable-next-line class-methods-use-this
  @Get()
  @Redirect('/administration', 302)
  // NestJS invokes this handler as an instance method without instance state.
  redirigerVersAdministration(): void {

  }
}
