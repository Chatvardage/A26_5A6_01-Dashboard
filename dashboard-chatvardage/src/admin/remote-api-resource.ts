import {
  BaseProperty, BaseRecord, BaseResource, ValidationError,
} from 'adminjs';

type ChampRessource = {
  path: string;
  type?: 'string' | 'textarea' | 'datetime' | 'uuid' | 'password';
  isId?: boolean;
  isSortable?: boolean;
};

export type ChargeurEnregistrements = (
  requete: <T>(chemin: string) => Promise<T>,
) => Promise<Record<string, unknown>[]>;

type ConfigurationRessourceDistante = {
  id: string;
  cheminListe: string;
  cheminCreation: string | ((parametres: Record<string, unknown>) => string);
  cheminSuppression: (id: string, enregistrement?: Record<string, unknown>) => string;
  suppressionDependanteEnregistrement?: boolean;
  champs: ChampRessource[];
  champsFiltrables: string[];
  champsFiltrablesExacts?: string[];
  normaliserChamp?: (champ: string, valeur: string) => string;
  transformerCreation?: (parametres: Record<string, unknown>) => Record<string, unknown>;
  validerCreation?: (parametres: Record<string, unknown>) => void;
  transformerLecture?: (enregistrement: Record<string, unknown>) => Record<string, unknown>;
  transformerApercu?: (enregistrement: Record<string, unknown>) => Record<string, unknown>;
  chargerEnregistrements?: ChargeurEnregistrements;
};

type FiltreAdminJS = {
  filters?: Record<string, { value?: unknown }>;
};

type EntreeCache = {
  expireLe: number;
  promesse: Promise<Record<string, unknown>[]>;
};

const dureeCacheLectureMs = 1000;
const longueurMinimaleJeton = 40;
const motifJetonJwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

type ErreurApiDistante = Error & { statut: number };

const estErreurApiDistante = (erreur: unknown): erreur is ErreurApiDistante => (
  erreur instanceof Error && 'statut' in erreur && typeof erreur.statut === 'number'
);

const creerErreurApiDistante = (message: string, statut: number): ErreurApiDistante => (
  Object.assign(new Error(message), { statut })
);

export class RessourceApiDistante extends BaseResource {
  private readonly proprietes: BaseProperty[];

  // Une entree par jeton : chaque session admin garde son propre resultat.
  private readonly caches = new Map<string | undefined, EntreeCache>();

  constructor(private readonly configuration: ConfigurationRessourceDistante) {
    super();
    this.proprietes = configuration.champs.map((champ) => new BaseProperty(champ));
  }

  // AdminJS requires this instance override even though it has no state.
  // eslint-disable-next-line class-methods-use-this
  databaseName(): string {
    return 'ChatVardage';
  }

  id(): string {
    return this.configuration.id;
  }

  properties(): BaseProperty[] {
    return this.proprietes;
  }

  property(path: string): BaseProperty | null {
    return this.proprietes.find((propriete) => propriete.path() === path) ?? null;
  }

  async count(filtre: unknown, contexte?: unknown): Promise<number> {
    return this.filtrer(await this.chargerEnregistrements(contexte), filtre).length;
  }

  async find(
    filtre: unknown,
    optionsRecherche: { limit?: number; offset?: number; sort?: { sortBy?: string; direction?: 'asc' | 'desc' } },
    contexte?: unknown,
  ): Promise<BaseRecord[]> {
    const enregistrements = this.filtrer(await this.chargerEnregistrements(contexte), filtre);
    const enregistrementsTries = RessourceApiDistante.trier(enregistrements, optionsRecherche.sort);
    const debut = optionsRecherche.offset ?? 0;
    const fin = optionsRecherche.limit === undefined ? undefined : debut + optionsRecherche.limit;

    return enregistrementsTries.slice(debut, fin).map((enregistrement) => this.build(enregistrement));
  }

  async findOne(id: string, contexte?: unknown): Promise<BaseRecord | null> {
    const enregistrement = (await this.chargerEnregistrements(contexte)).find(
      (element) => String(element.id) === id,
    );

    return enregistrement ? this.build(enregistrement) : null;
  }

  async findMany(identifiantsDemandes: Array<string | number>, contexte?: unknown): Promise<BaseRecord[]> {
    const identifiants = new Set(identifiantsDemandes.map(String));
    return (await this.chargerEnregistrements(contexte))
      .filter((element) => identifiants.has(String(element.id)))
      .map((enregistrement) => this.build(enregistrement));
  }

  build(parametres: Record<string, unknown>): BaseRecord {
    return new BaseRecord(parametres, this);
  }

  async create(parametres: Record<string, unknown>, contexte?: unknown): Promise<Record<string, unknown>> {
    this.configuration.validerCreation?.(parametres);
    const cheminCreation = typeof this.configuration.cheminCreation === 'function'
      ? this.configuration.cheminCreation(parametres)
      : this.configuration.cheminCreation;
    const corps = JSON.stringify(this.configuration.transformerCreation?.(parametres) ?? parametres);
    let enregistrement: Record<string, unknown>;

    try {
      enregistrement = await RessourceApiDistante.requete<Record<string, unknown>>(
        cheminCreation,
        contexte,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corps,
        },
      );
    } catch (erreur) {
      if (!estErreurApiDistante(erreur) || (erreur.statut !== 400 && erreur.statut !== 422)) {
        throw erreur;
      }

      const { message } = erreur;
      const correspondance = message.match(/^([\w]+):\s*(.+)$/);
      const correspondanceChamp = correspondance && this.property(correspondance[1])
        ? correspondance
        : undefined;
      const erreursParChamp = correspondanceChamp
        ? { [correspondanceChamp[1]]: { message: correspondanceChamp[2] } }
        : {};

      throw new ValidationError(erreursParChamp, correspondanceChamp ? undefined : { message });
    }

    this.invaliderCache();
    if (!enregistrement.id) throw new Error('Le service n a pas retourne l identifiant de l element cree.');
    return this.transformerLecture(enregistrement);
  }

  // AdminJS requires this instance override even though it has no state.
  // eslint-disable-next-line class-methods-use-this
  async update(): Promise<Record<string, unknown>> {
    throw new Error('La modification est geree par le service proprietaire.');
  }

  async delete(identifiant: string, contexte?: unknown): Promise<void> {
    // Le cache est bref et les champs servant au chemin ne changent pas apres creation.
    const enregistrement = this.configuration.suppressionDependanteEnregistrement
      ? (await this.chargerEnregistrements(contexte)).find(
        (element) => String(element.id) === identifiant,
      )
      : undefined;
    if (this.configuration.suppressionDependanteEnregistrement && !enregistrement) {
      throw new Error('Element introuvable pour la suppression.');
    }
    await RessourceApiDistante.requete(
      this.configuration.cheminSuppression(identifiant, enregistrement),
      contexte,
      { method: 'DELETE' },
    );
    this.invaliderCache();
  }

  private async chargerEnregistrements(contexte?: unknown): Promise<Record<string, unknown>[]> {
    const jeton = (contexte as { currentAdmin?: { jeton?: string } } | undefined)
      ?.currentAdmin?.jeton;
    const maintenant = Date.now();
    this.caches.forEach((entree, cle) => {
      if (entree.expireLe <= maintenant) this.caches.delete(cle);
    });
    const cache = this.caches.get(jeton);
    if (cache) return cache.promesse;

    const promesse = (async () => {
      let enregistrements: Record<string, unknown>[];
      if (this.configuration.chargerEnregistrements) {
        const requete = <T>(chemin: string) => RessourceApiDistante.requete<T>(chemin, contexte);
        enregistrements = await this.configuration.chargerEnregistrements(requete);
      } else {
        enregistrements = await RessourceApiDistante.requete<Record<string, unknown>[]>(
          this.configuration.cheminListe,
          contexte,
        );
      }
      return enregistrements.map((enregistrement) => this.transformerLecture(enregistrement));
    })();
    const cacheNouveau: EntreeCache = { expireLe: Number.POSITIVE_INFINITY, promesse };
    this.caches.set(jeton, cacheNouveau);

    try {
      const enregistrements = await promesse;
      if (this.caches.get(jeton) === cacheNouveau) {
        cacheNouveau.expireLe = Date.now() + dureeCacheLectureMs;
      }
      return enregistrements;
    } catch (erreur) {
      if (this.caches.get(jeton) === cacheNouveau) this.caches.delete(jeton);
      throw erreur;
    }
  }

  private invaliderCache(): void {
    this.caches.clear();
  }

  private static async requete<T>(
    chemin: string,
    contexte: unknown,
    optionsRequete: RequestInit = {},
  ): Promise<T> {
    const jeton = (contexte as { currentAdmin?: { jeton?: string } } | undefined)
      ?.currentAdmin?.jeton;

    if (typeof jeton !== 'string' || jeton.length < longueurMinimaleJeton || !motifJetonJwt.test(jeton)) {
      throw new Error('Session administrateur invalide. Reconnectez-vous.');
    }

    const reponse = await fetch(chemin, {
      ...optionsRequete,
      headers: {
        ...optionsRequete.headers,
        Authorization: `Bearer ${jeton}`,
      },
    });

    if (reponse.status === 401) {
      throw creerErreurApiDistante('La session administrateur a expire. Reconnectez-vous.', reponse.status);
    }

    if (reponse.ok) {
      if (reponse.status === 204) return undefined as T;
      return reponse.json() as Promise<T>;
    }

    const corps = await reponse.json().catch(() => ({})) as { message?: string; erreur?: string };
    throw creerErreurApiDistante(
      corps.message ?? corps.erreur ?? `Le service distant a retourne ${reponse.status}.`,
      reponse.status,
    );
  }

  private static trier(
    enregistrements: Record<string, unknown>[],
    tri?: { sortBy?: string; direction?: 'asc' | 'desc' },
  ): Record<string, unknown>[] {
    if (!tri?.sortBy) return enregistrements;

    const champ = tri.sortBy;
    const multiplicateur = tri.direction === 'desc' ? -1 : 1;
    // Copie requise : sort() trie sur place et le tableau recu peut etre celui du cache partage.
    return [...enregistrements].sort((gauche, droite) => String(gauche[champ] ?? '')
      .localeCompare(String(droite[champ] ?? '')) * multiplicateur);
  }

  private filtrer(enregistrements: Record<string, unknown>[], filtre: unknown): Record<string, unknown>[] {
    const filtres = (filtre as FiltreAdminJS | undefined)?.filters ?? {};
    const criteres = Object.entries(filtres)
      .filter(([champ, valeur]) => this.configuration.champsFiltrables.includes(champ)
        && typeof valeur.value === 'string'
        && valeur.value.trim() !== '');

    if (!criteres.length) return enregistrements;

    return enregistrements.filter((enregistrement) => criteres.every(([champ, valeur]) => {
      const valeurEnregistrement = this.normaliserValeur(champ, enregistrement[champ]);
      const valeurFiltre = this.normaliserValeur(champ, valeur.value);

      return champ === 'id' || this.configuration.champsFiltrablesExacts?.includes(champ)
        ? valeurEnregistrement === valeurFiltre
        : valeurEnregistrement.includes(valeurFiltre);
    }));
  }

  private normaliserValeur(champ: string, valeur: unknown): string {
    const valeurNormalisee = String(valeur ?? '').trim().toLowerCase();
    return this.configuration.normaliserChamp?.(champ, valeurNormalisee) ?? valeurNormalisee;
  }

  private transformerLecture(enregistrement: Record<string, unknown>): Record<string, unknown> {
    const enregistrementTransforme = this.configuration.transformerLecture?.(enregistrement) ?? enregistrement;
    return this.configuration.transformerApercu?.(enregistrementTransforme) ?? enregistrementTransforme;
  }
}
