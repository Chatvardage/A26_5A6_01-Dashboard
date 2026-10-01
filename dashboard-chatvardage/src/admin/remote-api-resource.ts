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
  transformerCreation?: (parametres: Record<string, unknown>) => Record<string, unknown>;
  validerCreation?: (parametres: Record<string, unknown>) => void;
  verifierCreation?: boolean;
  transformerLecture?: (enregistrement: Record<string, unknown>) => Record<string, unknown>;
  transformerApercu?: (enregistrement: Record<string, unknown>) => Record<string, unknown>;
  chargerEnregistrements?: ChargeurEnregistrements;
};

type FiltreAdminJS = {
  filters?: Record<string, { value?: unknown }>;
};

const dureeCacheLectureMs = 1000;

type ErreurApiDistante = Error & { statut: number };

const estErreurApiDistante = (erreur: unknown): erreur is ErreurApiDistante => (
  erreur instanceof Error && 'statut' in erreur && typeof erreur.statut === 'number'
);

const creerErreurApiDistante = (message: string, statut: number): ErreurApiDistante => (
  Object.assign(new Error(message), { statut })
);

export class RessourceApiDistante extends BaseResource {
  private readonly proprietes: BaseProperty[];

  private cacheEnregistrements?: {
    jeton?: string;
    expireLe: number;
    promesse: Promise<Record<string, unknown>[]>;
  };

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
    if (this.configuration.verifierCreation) {
      const enregistrements = await this.chargerEnregistrements(contexte);
      const estCree = enregistrements.some((element) => String(element.id) === String(enregistrement.id));
      if (!estCree) throw new Error('Le message n a pas ete confirme par le service.');
    }
    return this.transformerLecture(enregistrement);
  }

  // AdminJS requires this instance override even though it has no state.
  // eslint-disable-next-line class-methods-use-this
  async update(): Promise<Record<string, unknown>> {
    throw new Error('La modification est geree par le service proprietaire.');
  }

  async delete(identifiant: string, contexte?: unknown): Promise<void> {
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
    const cache = this.cacheEnregistrements;
    if (cache && cache.jeton === jeton && cache.expireLe > Date.now()) return cache.promesse;

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
    const cacheNouveau = { jeton, expireLe: Number.POSITIVE_INFINITY, promesse };
    this.cacheEnregistrements = cacheNouveau;

    try {
      const enregistrements = await promesse;
      if (this.cacheEnregistrements === cacheNouveau) {
        cacheNouveau.expireLe = Date.now() + dureeCacheLectureMs;
      }
      return enregistrements;
    } catch (erreur) {
      if (this.cacheEnregistrements === cacheNouveau) this.cacheEnregistrements = undefined;
      throw erreur;
    }
  }

  private invaliderCache(): void {
    this.cacheEnregistrements = undefined;
  }

  private static async requete<T>(
    chemin: string,
    contexte: unknown,
    optionsRequete: RequestInit = {},
  ): Promise<T> {
    const jeton = (contexte as { currentAdmin?: { jeton?: string } } | undefined)
      ?.currentAdmin?.jeton;

    if (typeof jeton !== 'string' || !/^[-A-Za-z0-9._~+/]+=*$/.test(jeton)) {
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

    const multiplicateur = tri.direction === 'desc' ? -1 : 1;
    return [...enregistrements].sort((gauche, droite) => String(gauche[tri.sortBy!])
      .localeCompare(String(droite[tri.sortBy!])) * multiplicateur);
  }

  private filtrer(enregistrements: Record<string, unknown>[], filtre: unknown): Record<string, unknown>[] {
    const filtres = (filtre as FiltreAdminJS | undefined)?.filters ?? {};
    const criteres = Object.entries(filtres)
      .filter(([champ, valeur]) => this.configuration.champsFiltrables.includes(champ)
        && typeof valeur.value === 'string'
        && valeur.value.trim() !== '');

    if (!criteres.length) return enregistrements;

    return enregistrements.filter((enregistrement) => criteres.every(([champ, valeur]) => {
      const valeurEnregistrement = RessourceApiDistante.normaliserValeur(champ, enregistrement[champ]);
      const valeurFiltre = RessourceApiDistante.normaliserValeur(champ, valeur.value);

      return champ === 'id'
        ? valeurEnregistrement === valeurFiltre
        : valeurEnregistrement.includes(valeurFiltre);
    }));
  }

  private static normaliserValeur(champ: string, valeur: unknown): string {
    if (champ === 'role' && typeof valeur === 'string') return RessourceApiDistante.normaliserRole(valeur);
    return String(valeur ?? '').trim().toLocaleLowerCase();
  }

  private static normaliserRole(role: string): string {
    const valeur = role.trim().toLocaleLowerCase();
    if (valeur === 'user' || valeur === 'utilisateur') return 'user';
    if (valeur === 'admin' || valeur === 'administrateur') return 'admin';
    return valeur;
  }

  private transformerLecture(enregistrement: Record<string, unknown>): Record<string, unknown> {
    const enregistrementTransforme = this.configuration.transformerLecture?.(enregistrement) ?? enregistrement;
    const avecRoleNormalise = typeof enregistrementTransforme.role === 'string'
      ? { ...enregistrementTransforme, role: RessourceApiDistante.normaliserRole(enregistrementTransforme.role) }
      : enregistrementTransforme;

    return this.configuration.transformerApercu?.(avecRoleNormalise) ?? avecRoleNormalise;
  }
}
