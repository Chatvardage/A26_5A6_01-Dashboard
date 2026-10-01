import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ControleurApplication {
  // NestJS exige une methode d'instance, meme sans etat.
  // eslint-disable-next-line class-methods-use-this
  @Get()
  @Redirect('/administration', 302)
  redirigerVersAdministration(): void {

  }
}
