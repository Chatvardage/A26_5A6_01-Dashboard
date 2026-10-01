import { jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

import { composantDestinationMessage } from './component-loader.js';
import options, { optionsRessource } from './options.js';
import { RessourceApiDistante } from './remote-api-resource.js';
import { limitePagesServeurs } from './resources/commun.js';

const jetonTest = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi0xIn0.c2lnbmF0dXJlLWRlLXRlc3Q';
const autreJetonTest = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi0yIn0.YXV0cmUtc2lnbmF0dXJlLXRlc3Q';
const contexteAdmin = { currentAdmin: { jeton: jetonTest } };
const entetesAdmin = { headers: { Authorization: `Bearer ${jetonTest}` } };

describe('Options AdminJS', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    // Les ressources sont des singletons de module : leur cache par jeton survivrait d'un test a l'autre.
    (options.resources ?? []).forEach((ressource) => {
      (ressource.resource as unknown as { caches: Map<unknown, unknown> }).caches.clear();
    });
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

    const enregistrements = await salons.find({}, {}, contexteAdmin);

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
      expect.objectContaining(entetesAdmin),
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

    const enregistrements = await messages.find({}, {}, contexteAdmin);

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
      expect.objectContaining(entetesAdmin),
    );

    await expect(messages.find(
      { filters: { messageType: { value: 'Salon' } } },
      {},
      contexteAdmin,
    )).resolves.toHaveLength(1);
    await expect(messages.find(
      { filters: { messageType: { value: 'Sal' } } },
      {},
      contexteAdmin,
    )).resolves.toHaveLength(0);
    await expect(messages.find(
      { filters: { senderId: { value: 'utilisateur-' } } },
      {},
      contexteAdmin,
    )).resolves.toHaveLength(0);

    await messages.delete('salon-1-message', contexteAdmin);
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

    await expect(messages.find({}, {}, contexteAdmin))
      .resolves.toHaveLength(1);
    rejeterSansErreur = true;
    await expect(messages.find({}, {}, { currentAdmin: { jeton: autreJetonTest } }))
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

  it('normalise les roles des utilisateurs a la lecture et au filtrage', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'u-1', role: 'ADMINISTRATEUR' },
        { id: 'u-2', role: 'utilisateur' },
        { id: 'u-3' },
      ],
    } as Response);
    const utilisateurs = (options.resources ?? [])[0].resource as RessourceApiDistante;

    const enregistrements = await utilisateurs.find({}, {}, contexteAdmin);
    const filtres = await utilisateurs.find({ filters: { role: { value: 'Utilisateur' } } }, {}, contexteAdmin);

    expect(enregistrements.map((enregistrement) => enregistrement.params.role)).toEqual(['admin', 'user', undefined]);
    expect(filtres.map((enregistrement) => enregistrement.params.id)).toEqual(['u-2']);
    await expect(utilisateurs.find({ filters: { pseudo: { value: 'absent' } } }, {}, contexteAdmin))
      .resolves.toHaveLength(0);
  });

  it('compacte l apercu d un message court et l omet si le contenu n est pas du texte', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => ({
      ok: true,
      status: 200,
      json: async () => (String(input).endsWith('/api/messages/admin')
        ? [{ id: 'prive-1', content: null }, { id: 'prive-2', content: ' Bonjour \n  salut ' }]
        : { serveurs: [], suivant: null }),
    } as Response));
    const messages = (options.resources ?? [])[3].resource as RessourceApiDistante;

    const [sansTexte, court] = await messages.find({}, {}, contexteAdmin);

    expect(sansTexte.params.apercu).toBeUndefined();
    expect(court.params.apercu).toBe('Bonjour salut');
  });

  it('plafonne la pagination si le service renvoie toujours une page suivante', async () => {
    const journaliser = jest.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ serveurs: [], suivant: 100 }),
    } as Response));
    const serveurs = (options.resources ?? [])[1].resource as RessourceApiDistante;

    await expect(serveurs.find({}, {}, contexteAdmin)).resolves.toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(limitePagesServeurs);
    expect(journaliser).toHaveBeenCalledWith(expect.stringContaining('Pagination interrompue'), 'DashboardAdmin');
  });

  it('arrete la pagination si le service omet le champ suivant', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ serveurs: [{ id: 'serveur-1', nom: 'Projet', public: true }] }),
    } as Response);
    const serveurs = (options.resources ?? [])[1].resource as RessourceApiDistante;

    await expect(serveurs.find({}, {}, { currentAdmin: { jeton: autreJetonTest } })).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

    const enregistrements = await serveurs.find({}, {}, contexteAdmin);

    expect(enregistrements).toHaveLength(2);
    expect(enregistrements.map((enregistrement) => enregistrement.params)).toEqual([
      expect.objectContaining({ name: 'Projet', visibility: 'public', memberCount: 4 }),
      expect.objectContaining({ name: 'Prive', visibility: 'private', memberCount: 2 }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3003/api/admin/servers?decalage=100&limite=100',
      expect.objectContaining(entetesAdmin),
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

    await expect(messages.find({}, {}, contexteAdmin)).resolves.toHaveLength(0);
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
    const contexte = contexteAdmin;

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
    const contexte = contexteAdmin;

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
    }, contexteAdmin);

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

    await expect(salons.create({ name: 'general', access: 'tous', writing: 'tous' }, contexteAdmin))
      .rejects.toMatchObject({
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
