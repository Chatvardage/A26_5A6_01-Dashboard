import { jest } from '@jest/globals';

import { RessourceApiDistante } from './remote-api-resource.js';

describe('RessourceApiDistante', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('relaye la creation au service proprietaire avec le jeton administrateur', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'message-1', content: 'Bonjour' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: ['senderId', 'recipientId'],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { senderId: 'user-1', recipientId: 'user-2', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toEqual({ id: 'message-1', content: 'Bonjour', apercu: 'Bonjour' });

    expect(fetchMock).toHaveBeenCalledWith('http://messages.test/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jeton-admin',
      },
      body: JSON.stringify({ senderId: 'user-1', recipientId: 'user-2', content: 'Bonjour' }),
    });
  });

  it('filtre et compte les seuls champs autorises', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'message-1', senderId: 'utilisateur-1', recipientId: 'utilisateur-2' },
        { id: 'message-2', senderId: 'utilisateur-3', recipientId: 'utilisateur-1' },
      ],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: ['senderId', 'recipientId'],
      champs: [{ path: 'id', type: 'uuid', isId: true }, { path: 'senderId', type: 'uuid' }],
    });
    const filtre = { filters: { senderId: { value: 'utilisateur-3' }, id: { value: 'message-1' } } };
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.count(filtre, contexte)).resolves.toBe(1);
    await expect(ressource.find(filtre, {}, contexte)).resolves.toHaveLength(1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retourne une erreur de validation au champ indique par le service', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'mot_de_passe: le mot de passe doit contenir entre 8 et 128 caracteres' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['id', 'pseudo', 'courriel', 'role'],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { pseudo: 'eva', mot_de_passe: 'court' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toMatchObject({
      statusCode: 400,
      propertyErrors: {
        mot_de_passe: { message: 'le mot de passe doit contenir entre 8 et 128 caracteres' },
      },
    });
  });

  it('envoie l expediteur choisi a la route de creation administrateur', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 'message-1', senderId: 'utilisateur-1' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      transformerCreation: ({ senderId, recipientId, content }) => ({ senderId, recipientId, content }),
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { senderId: 'utilisateur-1', recipientId: 'utilisateur-2', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toMatchObject({ id: 'message-1', senderId: 'utilisateur-1' });

    expect(fetchMock).toHaveBeenCalledWith('http://messages.test/api/messages/admin', expect.objectContaining({
      body: JSON.stringify({
        senderId: 'utilisateur-1',
        recipientId: 'utilisateur-2',
        content: 'Bonjour',
      }),
    }));
  });

  it('ajoute un apercu compact au message pour la liste', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'message-1', content: 'Bonjour\n  tout le monde' }],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages/admin',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'content', type: 'textarea' },
        { path: 'apercu', type: 'string' },
      ],
    });

    const [message] = await ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(message.params).toMatchObject({
      content: 'Bonjour\n  tout le monde',
      apercu: 'Bonjour tout le monde',
    });
  });

  it('cree un salon dans le serveur selectionne', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'salon-1', nom: 'general', acces: 'tous', ecriture: 'moderateurs',
      }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/servers',
      cheminCreation: ({ serverId }) => `http://salons.test/api/servers/${serverId}/channels`,
      cheminSuppression: (id) => `http://salons.test/api/channels/${id}`,
      champsFiltrables: [],
      transformerCreation: ({ name, access, writing }) => ({
        nom: name,
        acces: access,
        ecriture: writing,
      }),
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      {
        serverId: 'serveur-1', name: 'general', access: 'tous', writing: 'moderateurs',
      },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).resolves.toMatchObject({ id: 'salon-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://salons.test/api/servers/serveur-1/channels',
      expect.objectContaining({
        body: JSON.stringify({ nom: 'general', acces: 'tous', ecriture: 'moderateurs' }),
      }),
    );
  });

  it('transforme la reponse de salon pour les colonnes du tableau de bord', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{
        id: 'salon-1', nom: 'general', visibilite: 'prive', hoteId: 'admin-1',
      }],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/rooms',
      cheminCreation: 'http://salons.test/api/rooms',
      cheminSuppression: (id) => `http://salons.test/api/rooms/${id}`,
      champsFiltrables: [],
      transformerLecture: ({
        nom, visibilite, hoteId, ...salon
      }) => ({
        ...salon,
        name: nom,
        visibility: visibilite === 'prive' ? 'private' : visibilite,
        ownerId: hoteId,
      }),
      champs: [
        { path: 'id', type: 'uuid', isId: true },
        { path: 'name', type: 'string' },
        { path: 'visibility', type: 'string' },
        { path: 'ownerId', type: 'uuid' },
      ],
    });

    const [salon] = await ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } });

    expect(salon.params).toMatchObject({
      id: 'salon-1',
      name: 'general',
      visibility: 'private',
      ownerId: 'admin-1',
    });
  });

  it('charge des enregistrements derives avec une requete authentifiee', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ serveurs: [{ id: 'serveur-1' }] }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'salons',
      cheminListe: 'http://salons.test/api/admin/servers',
      cheminCreation: 'http://salons.test/api/servers',
      cheminSuppression: (id) => `http://salons.test/api/channels/${id}`,
      champsFiltrables: [],
      chargerEnregistrements: async (requete) => {
        const reponse = await requete<{ serveurs: Array<{ id: string }> }>(
          'http://salons.test/api/admin/servers?limite=100',
        );
        return reponse.serveurs.map((serveur) => ({ id: `${serveur.id}-salon` }));
      },
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.find({}, {}, { currentAdmin: { jeton: 'jeton-admin' } }))
      .resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://salons.test/api/admin/servers?limite=100',
      expect.objectContaining({ headers: { Authorization: 'Bearer jeton-admin' } }),
    );
  });

  it('refuse un succes sans identifiant de creation', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ message: 'Operation acceptee' }),
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'messages',
      cheminListe: 'http://messages.test/api/messages/admin',
      cheminCreation: 'http://messages.test/api/messages',
      cheminSuppression: (id) => `http://messages.test/api/messages/admin/${id}`,
      champsFiltrables: [],
      champs: [{ path: 'id', type: 'uuid', isId: true }],
    });

    await expect(ressource.create(
      { recipientId: 'utilisateur-1', content: 'Bonjour' },
      { currentAdmin: { jeton: 'jeton-admin' } },
    )).rejects.toMatchObject({ statusCode: 400 });
  });

  it('normalise les roles historiques pour le filtre', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        { id: 'utilisateur-1', role: 'utilisateur' },
        { id: 'administrateur-1', role: 'ADMINISTRATEUR' },
      ],
    } as Response);
    const ressource = new RessourceApiDistante({
      id: 'utilisateurs',
      cheminListe: 'http://auth.test/api/users',
      cheminCreation: 'http://auth.test/api/users',
      cheminSuppression: (id) => `http://auth.test/api/users/${id}`,
      champsFiltrables: ['role'],
      champs: [{ path: 'id', type: 'uuid', isId: true }, { path: 'role', type: 'string' }],
    });
    const contexte = { currentAdmin: { jeton: 'jeton-admin' } };

    await expect(ressource.count({ filters: { role: { value: 'user' } } }, contexte)).resolves.toBe(1);
    await expect(ressource.count({ filters: { role: { value: 'admin' } } }, contexte)).resolves.toBe(1);
  });
});
