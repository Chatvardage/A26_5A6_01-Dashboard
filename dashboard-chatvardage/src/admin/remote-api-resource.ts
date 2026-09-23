import { BaseProperty, BaseRecord, BaseResource } from 'adminjs';

type ChampRessource = {
  path: string;
  type?: 'string' | 'textarea' | 'datetime' | 'uuid';
  isId?: boolean;
  isSortable?: boolean;
};

type ConfigurationRessourceDistante = {
  id: string;
  cheminListe: string;
  cheminSuppression: (id: string) => string;
  champs: ChampRessource[];
};

export class RessourceApiDistante extends BaseResource {
  private readonly proprietes: BaseProperty[];

  constructor(private readonly configuration: ConfigurationRessourceDistante) {
    super();
    this.proprietes = configuration.champs.map((champ) => new BaseProperty(champ));
  }

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

  async count(_filter: unknown, contexte?: unknown): Promise<number> {
    return (await this.chargerEnregistrements(contexte)).length;
  }

  async find(
    _filter: unknown,
    optionsRecherche: { limit?: number; offset?: number; sort?: { sortBy?: string; direction?: 'asc' | 'desc' } },
    contexte?: unknown,
  ): Promise<BaseRecord[]> {
    const enregistrements = await this.chargerEnregistrements(contexte);
    const enregistrementsTries = this.trier(enregistrements, optionsRecherche.sort);
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

  async create(): Promise<Record<string, unknown>> {
    throw new Error('La creation est geree par le service proprietaire.');
  }

  async update(): Promise<Record<string, unknown>> {
    throw new Error('La modification est geree par le service proprietaire.');
  }

  async delete(identifiant: string, contexte?: unknown): Promise<void> {
    await this.requete(this.configuration.cheminSuppression(identifiant), contexte, { method: 'DELETE' });
  }

  private async chargerEnregistrements(contexte?: unknown): Promise<Record<string, unknown>[]> {
    return this.requete(this.configuration.cheminListe, contexte);
  }

  private async requete<T>(
    chemin: string,
    contexte: unknown,
    optionsRequete: RequestInit = {},
  ): Promise<T> {
    const jeton = (contexte as { currentAdmin?: { jeton?: string } } | undefined)
      ?.currentAdmin?.jeton;

    if (!jeton) throw new Error('Session administrateur invalide. Reconnectez-vous.');

    const reponse = await fetch(chemin, {
      ...optionsRequete,
      headers: {
        ...optionsRequete.headers,
        Authorization: `Bearer ${jeton}`,
      },
    });

    if (reponse.ok) {
      if (reponse.status === 204) return undefined as T;
      return reponse.json() as Promise<T>;
    }

    const corps = await reponse.json().catch(() => ({})) as { message?: string; erreur?: string };
    throw new Error(corps.message ?? corps.erreur ?? `Le service distant a retourne ${reponse.status}.`);
  }

  private trier(
    enregistrements: Record<string, unknown>[],
    tri?: { sortBy?: string; direction?: 'asc' | 'desc' },
  ): Record<string, unknown>[] {
    if (!tri?.sortBy) return enregistrements;

    const multiplicateur = tri.direction === 'desc' ? -1 : 1;
    return [...enregistrements].sort((gauche, droite) => String(gauche[tri.sortBy!])
      .localeCompare(String(droite[tri.sortBy!])) * multiplicateur);
  }
}