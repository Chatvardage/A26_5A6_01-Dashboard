import type { AdminJSOptions } from 'adminjs';

import chargeurComposants from './component-loader.js';
import { RessourceApiDistante } from './remote-api-resource.js';

const urlDuService = (variable: string, valeurParDefaut: string, chemin: string): string =>
  `${(process.env[variable] ?? valeurParDefaut).replace(/\/$/, '')}${chemin}`;

const optionsRessource = (nom: string, colonnes: string[]) => ({
  navigation: { name: 'Gestion', icon: 'View' },
  listProperties: colonnes,
  showProperties: colonnes,
  actions: {
    new: { isVisible: false },
    edit: { isVisible: false },
    bulkDelete: { isVisible: false },
  },
  label: nom,
});

const options: AdminJSOptions = {
  componentLoader: chargeurComposants,
  rootPath: '/administration',
  loginPath: '/administration/login',
  branding: {
    companyName: 'ChatVardage',
  },
  resources: [
    {
      resource: new RessourceApiDistante({
        id: 'utilisateurs',
        cheminListe: urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', '/api/users'),
        cheminSuppression: (id) => urlDuService('AUTH_SERVICE_URL', 'http://localhost:3001', `/api/users/${id}`),
        champs: [
          { path: 'id', type: 'uuid', isId: true },
          { path: 'pseudo', type: 'string', isSortable: true },
          { path: 'courriel', type: 'string', isSortable: true },
          { path: 'role', type: 'string', isSortable: true },
          { path: 'cree_le', type: 'datetime', isSortable: true },
          { path: 'modifie_le', type: 'datetime', isSortable: true },
        ],
      }),
      options: optionsRessource('Utilisateurs', ['pseudo', 'courriel', 'role', 'cree_le']),
    },
    {
      resource: new RessourceApiDistante({
        id: 'salons',
        cheminListe: urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', '/api/admin/rooms'),
        cheminSuppression: (id) => urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', `/api/rooms/${id}`),
        champs: [
          { path: 'id', type: 'uuid', isId: true },
          { path: 'name', type: 'string', isSortable: true },
          { path: 'visibility', type: 'string', isSortable: true },
          { path: 'ownerId', type: 'uuid', isSortable: true },
          { path: 'createdAt', type: 'datetime', isSortable: true },
          { path: 'updatedAt', type: 'datetime', isSortable: true },
        ],
      }),
      options: optionsRessource('Salons', ['name', 'visibility', 'ownerId', 'createdAt']),
    },
    {
      resource: new RessourceApiDistante({
        id: 'messages',
        cheminListe: urlDuService('MESSAGE_SERVICE_URL', 'http://localhost:3004', '/api/messages/admin'),
        cheminSuppression: (id) => urlDuService('MESSAGE_SERVICE_URL', 'http://localhost:3004', `/api/messages/admin/${id}`),
        champs: [
          { path: 'id', type: 'uuid', isId: true },
          { path: 'senderId', type: 'uuid', isSortable: true },
          { path: 'recipientId', type: 'uuid', isSortable: true },
          { path: 'content', type: 'textarea' },
          { path: 'createdAt', type: 'datetime', isSortable: true },
          { path: 'updatedAt', type: 'datetime', isSortable: true },
        ],
      }),
      options: optionsRessource('Messages', ['senderId', 'recipientId', 'content', 'createdAt']),
    },
  ],
  databases: [],
};

export default options;