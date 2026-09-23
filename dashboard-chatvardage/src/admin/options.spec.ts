import options from './options.js';

describe('Options AdminJS', () => {
  it('enregistre les ressources distantes de gestion', () => {
    const ressources = options.resources ?? [];
    const identifiants = ressources.map((ressource) => ressource.resource.id());

    expect(identifiants).toEqual(['utilisateurs', 'salons', 'messages']);
  });
});