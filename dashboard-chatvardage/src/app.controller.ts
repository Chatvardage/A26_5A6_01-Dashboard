import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ControleurApplication {
  @Get()
  @Redirect('/administration', 302)
  redirigerVersAdministration(): void {
    return;
  }
}
