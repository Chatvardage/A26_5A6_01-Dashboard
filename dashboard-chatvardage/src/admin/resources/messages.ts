import { Logger } from '@nestjs/common';
import { ValidationError } from 'adminjs';

import { composantDestinationMessage } from '../component-loader.js';
import { type ChargeurEnregistrements, RessourceApiDistante } from '../remote-api-resource.js';

import {
  chargerParLots, chargerTousLesSalons, cheminListeServeurs, cheminServeurs, optionsRessource, urlDuService,
} from './commun.js';

const urlMessages = (chemin: string): string => urlDuService('MESSAGE_SERVICE_URL', 'http://localhost:3004', chemin);

const cheminMessages = urlMessages('/api/messages/admin');
const cheminMessagesDeSalon = (channelId: string): string => urlMessages(
  `/api/messages/rooms/${encodeURIComponent(channelId)}/history?limit=100`,
);
const cheminCreationMessagesDeSalon = (channelId: string): string => urlMessages(
  `/api/messages/rooms/${encodeURIComponent(channelId)}/admin`,
);
const cheminSuppressionMessageDeSalon = (channelId: string, id: string): string => urlMessages(
  `/api/messages/rooms/${encodeURIComponent(channelId)}/${encodeURIComponent(id)}`,
);
const cheminSuppressionMessagePrive = (id: string): string => urlMessages(
  `/api/messages/admin/${encodeURIComponent(id)}`,
);

// Limite connue (README) : une requete d'historique par salon; une route d'agregation
// dans Message-Service remplacerait ce chargement.
const chargerTousLesMessages: ChargeurEnregistrements = async (requete) => {
  const [messagesPrives, salons] = await Promise.all([
    requete<Record<string, unknown>[]>(cheminMessages),
    chargerTousLesSalons(cheminListeServeurs, cheminServeurs)(requete),
  ]);
  const messagesDeSalon = await chargerParLots(salons, async (salon) => {
    const channelId = String(salon.id);
    try {
      const messages = await requete<Record<string, unknown>[]>(cheminMessagesDeSalon(channelId));
      return messages.map((message) => ({
        ...message,
        messageType: 'Salon',
        channelId,
        channelName: salon.nom,
        serverId: salon.serverId,
        serverName: salon.serverName,
      }));
    } catch (erreur) {
      const detail = erreur instanceof Error ? erreur.message : String(erreur);
      Logger.warn(`Impossible de charger les messages du salon ${channelId}: ${detail}`, 'DashboardAdmin');
      return [];
    }
  });

  return [
    ...messagesPrives.map((message) => ({ ...message, messageType: 'Prive' })),
    ...messagesDeSalon.flat(),
  ];
};

const transformerApercuMessage = (message: Record<string, unknown>): Record<string, unknown> => {
  if (typeof message.content !== 'string') return message;
  const contenuCompact = message.content.replace(/\s+/g, ' ').trim();
  return {
    ...message,
    apercu: contenuCompact.length > 120 ? `${contenuCompact.slice(0, 120)}...` : contenuCompact,
  };
};

export const ressourceMessages = {
  resource: new RessourceApiDistante({
    id: 'messages',
    cheminListe: cheminMessages,
    cheminCreation: ({ channelId }) => (channelId
      ? cheminCreationMessagesDeSalon(String(channelId))
      : cheminMessages),
    cheminSuppression: (id, message) => (typeof message?.channelId === 'string'
      ? cheminSuppressionMessageDeSalon(message.channelId, id)
      : cheminSuppressionMessagePrive(id)),
    suppressionDependanteEnregistrement: true,
    champsFiltrables: [
      'messageType', 'recipientId', 'senderId', 'serverId', 'serverName', 'channelId', 'channelName',
    ],
    champsFiltrablesExacts: ['messageType', 'recipientId', 'senderId', 'serverId', 'channelId'],
    chargerEnregistrements: chargerTousLesMessages,
    transformerCreation: ({
      senderId, recipientId, channelId, content,
    }) => (channelId
      ? { authorId: senderId, content }
      : { senderId, recipientId, content }),
    transformerLecture: (message) => ({
      ...message,
      ...(typeof message.authorId === 'string' ? { senderId: message.authorId } : {}),
      ...(typeof message.roomId === 'string' ? { channelId: message.roomId } : {}),
    }),
    transformerApercu: transformerApercuMessage,
    validerCreation: ({ recipientId, channelId }) => {
      // Exactement une destination; un channelId vide ('') compte comme absent (message prive).
      if (Boolean(recipientId) === Boolean(channelId)) {
        throw new ValidationError({}, { message: 'Choisissez soit un destinataire, soit un salon.' });
      }
    },
    champs: [
      { path: 'id', type: 'uuid', isId: true },
      { path: 'messageType', type: 'string', isSortable: true },
      { path: 'senderId', type: 'uuid', isSortable: true },
      { path: 'recipientId', type: 'uuid', isSortable: true },
      { path: 'serverId', type: 'uuid' },
      { path: 'serverName', type: 'string', isSortable: true },
      { path: 'channelId', type: 'uuid' },
      { path: 'channelName', type: 'string', isSortable: true },
      { path: 'content', type: 'textarea' },
      { path: 'apercu', type: 'string' },
      { path: 'createdAt', type: 'datetime', isSortable: true },
      { path: 'updatedAt', type: 'datetime', isSortable: true },
    ],
  }),
  options: optionsRessource(
    'Messages',
    ['messageType', 'senderId', 'recipientId', 'serverName', 'channelName', 'apercu', 'createdAt'],
    ['senderId', 'recipientId', 'channelId', 'content'],
    ['messageType', 'recipientId', 'senderId', 'serverId', 'serverName', 'channelId', 'channelName'],
    {
      id: { label: 'Identifiant' },
      messageType: { label: 'Type de message' },
      senderId: {
        label: 'Expediteur',
        isRequired: true,
        reference: 'utilisateurs',
      },
      recipientId: {
        label: 'Destinataire',
        description: 'Choisissez un destinataire ou un salon, pas les deux.',
        reference: 'utilisateurs',
        components: { edit: composantDestinationMessage },
      },
      serverId: { label: 'Serveur' },
      serverName: { label: 'Serveur' },
      channelId: {
        label: 'Salon',
        description: 'Choisissez un destinataire ou un salon, pas les deux.',
        reference: 'salons',
        components: { edit: composantDestinationMessage },
      },
      channelName: { label: 'Salon' },
      content: { label: 'Contenu', isRequired: true },
      apercu: {
        label: 'Apercu',
        isTitle: true,
        isVisible: { show: false, edit: false, filter: false },
      },
      createdAt: { label: 'Cree le' },
      updatedAt: { label: 'Modifie le' },
    },
    'apercu',
    ['messageType', 'senderId', 'recipientId', 'serverName', 'channelName', 'content', 'createdAt'],
  ),
};
