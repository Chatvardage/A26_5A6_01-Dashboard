import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { composantDestinationMessage } from './component-loader.js';
import options, { optionsRessource } from './options.js';
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
      ['senderId', 'recipientId', 'channelId', 'content'],
    ]);
    expect(ressources[3].options?.listProperties).toEqual([
      'messageType',
      'senderId',
      'recipientId',
      'serverName',
      'channelName',
      'apercu',
      'createdAt',
    ]);
    expect(ressources[3].options?.showProperties).toEqual([
      'messageType',
      'senderId',
      'recipientId',
      'serverName',
      'channelName',
      'content',
      'createdAt',
    ]);
    expect(ressources.map((ressource) => ressource.options?.filterProperties)).toEqual([
      ['pseudo', 'courriel', 'role'],
      ['name', 'visibility'],
      ['serverId', 'serverName', 'name', 'access', 'writing'],
      ['messageType', 'recipientId', 'senderId', 'serverId', 'serverName', 'channelId', 'channelName'],
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
    expect(ressources[3].options?.properties?.recipientId).toMatchObject({
      components: { edit: composantDestinationMessage },
      description: 'Choisissez un destinataire ou un salon, pas les deux.',
    });
    expect(ressources[3].options?.properties?.channelId).toMatchObject({
      components: { edit: composantDestinationMessage },
      description: 'Choisissez un destinataire ou un salon, pas les deux.',
    });
  });

  it('charge les salons a partir des serveurs administrables', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [{ id: 'serveur-1' }, { id: 'serveur-2' }], suivant: null }),
        } as Response;
      }

      if (chemin.endsWith('/api/servers/serveur-2')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'serveur-2', nom: 'Sans salons', salons: 'invalide' }),
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
          }, null, 'invalide'],
        }),
      } as Response;
    });
    const ressources = options.resources ?? [];
    const salons = ressources[2].resource as RessourceApiDistante;

    const enregistrements = await salons.find({}, {}, { currentAdmin: { jeton: 'header.payload.signature' } });

    expect(enregistrements[0].params).toMatchObject({
      id: 'salon-1',
      name: 'general',
      serverId: 'serveur-1',
      serverName: 'Projet',
      referenceName: 'general (Projet)',
      access: 'tous',
      writing: 'tous',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/servers/serveur-1',
      expect.objectContaining({ headers: { Authorization: 'Bearer header.payload.signature' } }),
    );
  });

  it('charge les messages prives et les messages de salon avec leur provenance', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/messages/admin')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'prive-1', senderId: 'utilisateur-1', recipientId: 'utilisateur-2' }],
        } as Response;
      }
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [{ id: 'serveur-1' }], suivant: null }),
        } as Response;
      }
      if (chemin.endsWith('/api/servers/serveur-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'serveur-1', nom: 'Projet', salons: [{ id: 'salon-1', nom: 'general' }],
          }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{
          id: 'salon-1-message',
          roomId: 'salon-1',
          authorId: 'utilisateur-1',
          content: 'a'.repeat(121),
        }],
      } as Response;
    });
    const ressources = options.resources ?? [];
    const messages = ressources[3].resource as RessourceApiDistante;

    const enregistrements = await messages.find({}, {}, { currentAdmin: { jeton: 'header.payload.signature' } });

    expect(enregistrements.map((enregistrement) => enregistrement.params)).toEqual([
      expect.objectContaining({
        id: 'prive-1', recipientId: 'utilisateur-2', messageType: 'Prive',
      }),
      expect.objectContaining({
        id: 'salon-1-message',
        messageType: 'Salon',
        serverId: 'serveur-1',
        serverName: 'Projet',
        channelId: 'salon-1',
        channelName: 'general',
        senderId: 'utilisateur-1',
        apercu: `${'a'.repeat(120)}...`,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/rooms/salon-1/history?limit=100',
      expect.objectContaining({ headers: { Authorization: 'Bearer header.payload.signature' } }),
    );

    await expect(messages.find(
      { filters: { messageType: { value: 'Salon' } } },
      {},
      { currentAdmin: { jeton: 'header.payload.signature' } },
    )).resolves.toHaveLength(1);
    await expect(messages.find(
      { filters: { messageType: { value: 'Sal' } } },
      {},
      { currentAdmin: { jeton: 'header.payload.signature' } },
    )).resolves.toHaveLength(0);
    await expect(messages.find(
      { filters: { senderId: { value: 'utilisateur-' } } },
      {},
      { currentAdmin: { jeton: 'header.payload.signature' } },
    )).resolves.toHaveLength(0);

    await messages.delete('salon-1-message', { currentAdmin: { jeton: 'header.payload.signature' } });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/rooms/salon-1/salon-1-message',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('conserve les messages disponibles pour les erreurs standard et non standard', async () => {
    const journaliser = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    let rejeterSansErreur = false;
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/messages/admin')) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'prive-1', senderId: 'utilisateur-1', recipientId: 'utilisateur-2' }],
        } as Response;
      }
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [{ id: 'serveur-1' }], suivant: null }),
        } as Response;
      }
      if (chemin.endsWith('/api/servers/serveur-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'serveur-1', nom: 'Projet', salons: [{ id: 'salon-1', nom: 'general' }],
          }),
        } as Response;
      }
      if (rejeterSansErreur) {
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject('Erreur reseau non standard');
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ message: 'Erreur interne' }),
      } as Response;
    });
    const ressources = options.resources ?? [];
    const messages = ressources[3].resource as RessourceApiDistante;

    await expect(messages.find({}, {}, { currentAdmin: { jeton: 'header.payload.signature' } }))
      .resolves.toHaveLength(1);
    rejeterSansErreur = true;
    await expect(messages.find({}, {}, { currentAdmin: { jeton: 'other.header.payload' } }))
      .resolves.toHaveLength(1);
    expect(journaliser).toHaveBeenCalledWith(
      expect.stringContaining('Impossible de charger les messages du salon salon-1'),
      'DashboardAdmin',
    );
    expect(journaliser).toHaveBeenCalledWith(
      expect.stringContaining('Erreur reseau non standard'),
      'DashboardAdmin',
    );
  });

  it('charge toutes les pages de serveurs et transforme leurs proprietes', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            serveurs: [{
              id: 'serveur-1', nom: 'Projet', public: true, nombreMembres: 4,
            }],
            suivant: 100,
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          serveurs: [{
            id: 'serveur-2', nom: 'Prive', public: false, nombreMembres: 2,
          }],
          suivant: null,
        }),
      } as Response;
    });
    const ressources = options.resources ?? [];
    const serveurs = ressources[1].resource as RessourceApiDistante;

    const enregistrements = await serveurs.find({}, {}, { currentAdmin: { jeton: 'header.payload.signature' } });

    expect(enregistrements).toHaveLength(2);
    expect(enregistrements.map((enregistrement) => enregistrement.params)).toEqual([
      expect.objectContaining({ name: 'Projet', visibility: 'public', memberCount: 4 }),
      expect.objectContaining({ name: 'Prive', visibility: 'private', memberCount: 2 }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/admin/servers?decalage=100&limite=100',
      expect.objectContaining({ headers: { Authorization: 'Bearer header.payload.signature' } }),
    );
  });

  it('limite a cinq les requetes simultanees aux historiques de salons', async () => {
    let requetesActives = 0;
    let maximumRequetesActives = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/messages/admin')) {
        return { ok: true, status: 200, json: async () => [] } as Response;
      }
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [{ id: 'serveur-1' }], suivant: null }),
        } as Response;
      }
      if (chemin.endsWith('/api/servers/serveur-1')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'serveur-1',
            nom: 'Projet',
            salons: Array.from({ length: 12 }, (_, index) => ({ id: `salon-${index}`, nom: 'general' })),
          }),
        } as Response;
      }

      requetesActives += 1;
      maximumRequetesActives = Math.max(maximumRequetesActives, requetesActives);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      requetesActives -= 1;
      return { ok: true, status: 200, json: async () => [] } as Response;
    });
    const ressources = options.resources ?? [];
    const messages = ressources[3].resource as RessourceApiDistante;

    await expect(messages.find({}, {}, {
      currentAdmin: { jeton: 'header.payload.signature' },
    })).resolves.toHaveLength(0);
    expect(maximumRequetesActives).toBe(5);
  });

  it('adapte les creations et suppressions de chaque ressource', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, initialisation) => {
      const chemin = String(input);
      if (chemin.endsWith('/api/messages/admin') && initialisation?.method === undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => [{ id: 'element-1' }],
        } as Response;
      }
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [], suivant: null }),
        } as Response;
      }
      return {
        ok: true,
        status: initialisation?.method === 'DELETE' ? 204 : 201,
        json: async () => ({ id: 'element-1', nom: 'Element', public: true }),
      } as Response;
    });
    const ressources = options.resources ?? [];
    const [utilisateurs, serveurs, salons, messages] = ressources.map(
      (ressource) => ressource.resource as RessourceApiDistante,
    );
    const contexte = { currentAdmin: { jeton: 'header.payload.signature' } };

    await utilisateurs.delete('utilisateur/1', contexte);
    await serveurs.create({ name: 'Public', visibility: 'public' }, contexte);
    await serveurs.delete('serveur/1', contexte);
    await salons.create({
      serverId: 'serveur-1', name: 'general', access: 'tous', writing: 'tous',
    }, contexte);
    await salons.delete('salon/1', contexte);
    await messages.create({
      senderId: 'utilisateur-1', recipientId: 'utilisateur-2', content: 'Bonjour',
    }, contexte);
    await messages.create({
      senderId: 'utilisateur-1', channelId: 'salon-1', content: 'Bonjour le salon',
    }, contexte);
    await messages.delete('element-1', contexte);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/users/utilisateur%2F1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/servers/serveur%2F1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/channels/salon%2F1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/servers/serveur-1/channels',
      expect.objectContaining({
        body: JSON.stringify({ nom: 'general', acces: 'tous', ecriture: 'tous' }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/admin',
      expect.objectContaining({
        body: JSON.stringify({
          senderId: 'utilisateur-1',
          recipientId: 'utilisateur-2',
          content: 'Bonjour',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/rooms/salon-1/admin',
      expect.objectContaining({
        body: JSON.stringify({
          authorId: 'utilisateur-1',
          content: 'Bonjour le salon',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/admin/element-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('refuse un message sans destination ou avec deux destinations', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressources = options.resources ?? [];
    const messages = ressources[3].resource as RessourceApiDistante;
    const contexte = { currentAdmin: { jeton: 'header.payload.signature' } };

    await expect(messages.create({ senderId: 'utilisateur-1', content: 'Bonjour' }, contexte))
      .rejects.toMatchObject({ baseError: { message: 'Choisissez soit un destinataire, soit un salon.' } });
    await expect(messages.create({
      senderId: 'utilisateur-1', recipientId: 'utilisateur-2', channelId: 'salon-1', content: 'Bonjour',
    }, contexte)).rejects.toMatchObject({ baseError: { message: 'Choisissez soit un destinataire, soit un salon.' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('traite un channelId vide comme un message prive lorsque le destinataire est defini', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const chemin = String(input);
      if (init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ id: 'message-prive-1' }) } as Response;
      }
      if (chemin.endsWith('/api/admin/servers?decalage=0&limite=100')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ serveurs: [], suivant: null }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => [{ id: 'message-prive-1', content: 'Bonjour' }],
      } as Response;
    });
    const ressources = options.resources ?? [];
    const messages = ressources[3].resource as RessourceApiDistante;

    await messages.create({
      senderId: 'utilisateur-1', recipientId: 'utilisateur-2', channelId: '', content: 'Bonjour',
    }, { currentAdmin: { jeton: 'header.payload.signature' } });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3004/api/messages/admin',
      expect.objectContaining({
        body: JSON.stringify({
          senderId: 'utilisateur-1', recipientId: 'utilisateur-2', content: 'Bonjour',
        }),
      }),
    );
  });

  it('refuse de creer un salon sans serveur avant d appeler Room-Service', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const ressources = options.resources ?? [];
    const salons = ressources[2].resource as RessourceApiDistante;

    await expect(salons.create({ name: 'general', access: 'tous', writing: 'tous' }, {
      currentAdmin: { jeton: 'header.payload.signature' },
    })).rejects.toMatchObject({
      propertyErrors: { serverId: { message: 'Le serveur est requis.' } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('utilise les valeurs par defaut des options de ressource', () => {
    expect(optionsRessource('Test', ['id'], ['nom'], ['nom'])).toMatchObject({
      showProperties: ['id'],
      properties: {},
      actions: { new: { isVisible: true } },
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
    expect(ressources[2].options?.titleProperty).toBe('referenceName');
    expect(ressources[2].options?.properties?.referenceName).toMatchObject({ isTitle: true });
    expect(ressources[3].options?.titleProperty).toBe('apercu');
    expect(ressources[3].options?.properties?.apercu).toMatchObject({ isTitle: true });
  });
});
