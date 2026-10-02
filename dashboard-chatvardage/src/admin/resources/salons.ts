import { ValidationError } from 'adminjs';

import { RessourceApiDistante } from '../remote-api-resource.js';

import {
  cheminListeServeurs, cheminServeurs, chargerTousLesSalons, optionsRessource, urlDuService,
} from './commun.js';

const cheminSuppressionSalon = (id: string): string => {
  const chemin = `/api/channels/${encodeURIComponent(id)}`;
  return urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', chemin);
};

export const ressourceSalons = {
  resource: new RessourceApiDistante({
    id: 'salons',
    cheminListe: cheminListeServeurs,
    cheminCreation: ({ serverId }) => `${cheminServeurs}/${encodeURIComponent(String(serverId))}/channels`,
    cheminSuppression: cheminSuppressionSalon,
    champsFiltrables: ['serverId', 'serverName', 'name', 'access', 'writing'],
    champsFiltrablesExacts: ['serverId', 'access', 'writing'],
    chargerEnregistrements: chargerTousLesSalons(cheminListeServeurs, cheminServeurs),
    validerCreation: ({ serverId }) => {
      if (typeof serverId !== 'string' || !serverId.trim()) {
        throw new ValidationError({ serverId: { message: 'Le serveur est requis.' } });
      }
    },
    transformerCreation: ({ name, access, writing }) => ({
      nom: name,
      acces: access,
      ecriture: writing,
    }),
    transformerLecture: ({
      nom, acces, ecriture, creePar, ...salon
    }) => ({
      ...salon,
      name: nom,
      access: acces,
      writing: ecriture,
      createdBy: creePar,
    }),
    champs: [
      { path: 'id', type: 'uuid', isId: true },
      { path: 'serverId', type: 'uuid' },
      { path: 'name', type: 'string', isSortable: true },
      { path: 'referenceName', type: 'string' },
      { path: 'serverName', type: 'string', isSortable: true },
      { path: 'access', type: 'string', isSortable: true },
      { path: 'writing', type: 'string', isSortable: true },
      { path: 'position', type: 'string', isSortable: true },
    ],
  }),
  options: optionsRessource(
    'Salons',
    ['name', 'serverName', 'access', 'writing', 'position'],
    ['serverId', 'name', 'access', 'writing'],
    ['serverId', 'serverName', 'name', 'access', 'writing'],
    {
      id: { label: 'Identifiant' },
      name: { label: 'Nom', isRequired: true },
      referenceName: {
        label: 'Salon',
        isTitle: true,
        isVisible: {
          list: false, show: false, edit: false, filter: false,
        },
      },
      serverId: {
        label: 'Serveur',
        isRequired: true,
        reference: 'serveurs',
        isVisible: { list: false, show: true, edit: true },
      },
      serverName: { label: 'Serveur' },
      access: {
        label: 'Acces',
        isRequired: true,
        availableValues: [
          { value: 'tous', label: 'Tous' },
          { value: 'moderateurs', label: 'Moderateurs' },
        ],
      },
      writing: {
        label: 'Ecriture',
        isRequired: true,
        availableValues: [
          { value: 'tous', label: 'Tous' },
          { value: 'moderateurs', label: 'Moderateurs' },
        ],
      },
      position: { label: 'Position' },
      createdBy: { label: 'Cree par' },
    },
    'referenceName',
    ['name', 'serverName', 'access', 'writing', 'position', 'createdBy'],
  ),
};
