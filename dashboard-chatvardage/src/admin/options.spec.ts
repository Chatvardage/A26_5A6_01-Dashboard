import { jest } from '@jest/globals';

import options from './options.js';
import { RessourceApiDistante } from './remote-api-resource.js';

describe('Options AdminJS', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enregistre les ressources distantes de gestion', () => {
    const ressources = options.resources ?? [];
    const identifiants = ressources.map((ressource) => ressource.resource.id());

    expect(identifiants).toEqual(['utilisateurs', 'serveurs', 'salons', 'messages']);
  });

  it('active la creation avec les seuls champs inscriptibles', () => {
    const ressources = options.resources ?? [];

    expect(ressources.map((ressource) => ressource.options?.actions?.new?.isVisible))
      .toEqual([true, true, true, true]);
    expect(ressources.map((ressource) => ressource.options?.editProperties)).toEqual([
      ['pseudo', 'courriel', 'mot_de_passe', 'role'],
      ['name', 'visibility'],
      ['serverId', 'name', 'access', 'writing'],
      ['senderId', 'recipientId', 'content'],
    ]);
    expect(ressources[3].options?.listProperties).toEqual([
      'senderId',
      'recipientId',
      'apercu',
      'createdAt',
    ]);
    expect(ressources[3].options?.showProperties).toEqual([
      'senderId',
      'recipientId',
      'content',
      'createdAt',
    ]);
    expect(ressources.map((ressource) => ressource.options?.filterProperties)).toEqual([
      ['pseudo', 'courriel', 'role'],
      ['name', 'visibility'],
      ['serverId', 'serverName', 'name', 'access', 'writing'],
      ['recipientId', 'senderId'],
    ]);
  });

  it('configure les listes deroulantes de serveurs, salons et messages', () => {
    const ressources = options.resources ?? [];

    expect(ressources[1].options?.properties?.visibility).toMatchObject({
      availableValues: [
        { value: 'public', label: 'Public' },
        { value: 'private', label: 'Prive' },
      ],
    });
    expect(ressources[2].options?.properties?.access).toMatchObject({
      availableValues: [
        { value: 'tous', label: 'Tous' },
        { value: 'moderateurs', label: 'Moderateurs' },
      ],
    });
    expect(ressources[2].options?.properties?.serverId).toMatchObject({
      isRequired: true,
      reference: 'serveurs',
    });
    expect(ressources[3].options?.properties?.senderId).toMatchObject({ reference: 'utilisateurs' });
    expect(ressources[3].options?.properties?.recipientId).toMatchObject({ reference: 'utilisateurs' });
  });

  it('charge les salons a partir des serveurs administrables', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [{ id: 'serveur-1' }], suivant: null }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'serveur-1',
          nom: 'Projet',
          salons: [{
            id: 'salon-1', nom: 'general', acces: 'tous', ecriture: 'tous', position: 0,
          }],
        }),
      } as Response;
    });
    const ressources = options.resources ?? [];
    const salons = ressources[2].resource as RessourceApiDistante;

    const enregistrements = await salons.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(enregistrements[0].params).toMatchObject({
      id: 'salon-1',
      name: 'general',
      serverId: 'serveur-1',
      serverName: 'Projet',
      access: 'tous',
      writing: 'tous',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/servers/serveur-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer jeton-admin' } }),
    );
  });

  it('configure une langue francaise avec une langue de repli', () => {
    expect(options.locale).toMatchObject({
      language: 'fr',
      fallbackLng: 'en',
      translations: {
        fr: {
          labels: { navigation: 'Navigation' },
          messages: { welcomeOnBoard_title: 'Bienvenue dans ChatVardage!' },
        },
      },
    });
  });

  it('limite le role utilisateur aux valeurs autorisees', () => {
    const ressources = options.resources ?? [];
    const utilisateurs = ressources[0].options;

    expect(utilisateurs?.properties?.role).toMatchObject({
      label: 'Role',
      isRequired: true,
      availableValues: [
        { value: 'user', label: 'Utilisateur' },
        { value: 'admin', label: 'Administrateur' },
      ],
    });
  });

  it('definit des titres lisibles pour les utilisateurs et les messages', () => {
    const ressources = options.resources ?? [];

    expect(ressources[0].options?.titleProperty).toBe('pseudo');
    expect(ressources[0].options?.properties?.pseudo).toMatchObject({ isTitle: true });
    expect(ressources[1].options?.titleProperty).toBe('name');
    expect(ressources[1].options?.properties?.name).toMatchObject({ isTitle: true });
    expect(ressources[3].options?.titleProperty).toBe('apercu');
    expect(ressources[3].options?.properties?.apercu).toMatchObject({ isTitle: true });
  });
});
