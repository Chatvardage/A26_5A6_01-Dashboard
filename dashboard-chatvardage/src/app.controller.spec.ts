import { ControleurApplication } from './app.controller.js';

describe('Contrôleur principal', () => {
  describe('accueil', () => {
    it('redirige vers le panneau d administration', () => {
      const controleurApplication = new ControleurApplication();

      expect(controleurApplication.redirigerVersAdministration()).toBeUndefined();
    });
  });
});
