import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class ControleurApplication {
  // Handler sans etat : class-methods-use-this ne s'applique pas a une route NestJS.
  // eslint-disable-next-line class-methods-use-this
  @Get()
  @Redirect('/administration', 302)
  redirigerVersAdministration(): void {
    // La redirection est entierement declaree par @Redirect.
  }
}
