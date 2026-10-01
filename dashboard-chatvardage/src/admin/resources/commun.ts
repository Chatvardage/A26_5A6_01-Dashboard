import { Logger } from '@nestjs/common';

import { type ChargeurEnregistrements } from '../remote-api-resource.js';

export const urlDuService = (
  variable: string,
  valeurParDefaut: string,
  chemin: string,
): string => `${(process.env[variable] ?? valeurParDefaut).replace(/\/$/, '')}${chemin}`;

type PageServeurs = {
  serveurs: Record<string, unknown>[];
  suivant: number | null;
};

const tailleLotRequetes = 5;
// 50 pages x 100 = 5 000 serveurs au plus en memoire par chargement.
export const limitePagesServeurs = 50;

export const chargerParLots = async <T, R>(
  elements: T[],
  charger: (element: T) => Promise<R>,
): Promise<R[]> => {
  const resultats: R[] = [];
  for (let index = 0; index < elements.length; index += tailleLotRequetes) {
    // Le lot borne les requêtes simultanées adressées aux microservices.
    // eslint-disable-next-line no-await-in-loop
    const lot = await Promise.all(elements.slice(index, index + tailleLotRequetes).map(charger));
    resultats.push(...lot);
  }
  return resultats;
};

const chargerPageServeurs = async (
  requete: <T>(chemin: string) => Promise<T>,
  chemin: string,
): Promise<Record<string, unknown>[]> => {
  const serveurs: Record<string, unknown>[] = [];
  let decalage: number | null = 0;

  for (let pages = 0; decalage !== null; pages += 1) {
    if (pages >= limitePagesServeurs) {
      Logger.warn(`Pagination interrompue apres ${limitePagesServeurs} pages pour ${chemin}`, 'DashboardAdmin');
      break;
    }
    // Sequentiel par necessite : seule la reponse d'une page donne le decalage de la suivante.
    // eslint-disable-next-line no-await-in-loop
    const page: Partial<PageServeurs> = await requete<PageServeurs>(`${chemin}?decalage=${decalage}&limite=100`);
    if (!Array.isArray(page.serveurs)) {
      Logger.warn(`Reponse inattendue de ${chemin} : champ 'serveurs' absent`, 'DashboardAdmin');
      break;
    }
    serveurs.push(...page.serveurs);
    decalage = page.suivant ?? null;
  }

  return serveurs;
};

export const chargerTousLesServeurs = (chemin: string): ChargeurEnregistrements => {
  const charger = async (requete: Parameters<ChargeurEnregistrements>[0]) => chargerPageServeurs(requete, chemin);
  return charger;
};

export const chargerTousLesSalons = (
  cheminListeServeurs: string,
  cheminServeurs: string,
): ChargeurEnregistrements => async (requete) => {
  const serveurs = await chargerTousLesServeurs(cheminListeServeurs)(requete);
  const details = await chargerParLots(
    serveurs,
    (serveur) => requete<Record<string, unknown>>(
      `${cheminServeurs}/${encodeURIComponent(String(serveur.id))}`,
    ),
  );

  return details.flatMap((serveur) => {
    const salons = Array.isArray(serveur.salons) ? serveur.salons : [];
    return salons
      .filter((salon): salon is Record<string, unknown> => typeof salon === 'object' && salon !== null)
      .map((salon) => ({
        ...salon,
        serverId: serveur.id,
        serverName: serveur.nom,
        referenceName: `${salon.nom} (${serveur.nom})`,
      }));
  });
};

export const optionsRessource = (
  nom: string,
  colonnes: string[],
  champsCreation: string[],
  champsFiltre: string[],
  proprietes?: Record<string, object>,
  proprieteTitre?: string,
  champsDetails?: string[],
  peutCreer?: boolean,
) => ({
  navigation: { name: 'Gestion', icon: 'View' },
  listProperties: colonnes,
  showProperties: champsDetails ?? colonnes,
  editProperties: champsCreation,
  filterProperties: champsFiltre,
  properties: proprietes ?? {},
  titleProperty: proprieteTitre,
  actions: {
    new: { isVisible: peutCreer ?? true },
    edit: { isVisible: false },
    bulkDelete: { isVisible: false },
  },
  label: nom,
});

export const cheminListeServeurs = urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', '/api/admin/servers');
export const cheminServeurs = urlDuService('ROOM_SERVICE_URL', 'http://localhost:3003', '/api/servers');
