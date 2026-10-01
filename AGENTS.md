# AGENTS.md — Chatvardage Dashboard

Ce fichier contient les règles de travail pour tout agent IA ou développeur qui modifie ce dépôt. Le code est dans `dashboard-chatvardage/`; le détail du fonctionnement est dans le `README.md`.

## Choix délibérés (ne pas « corriger »)

Ces points ont été relevés en revue et volontairement non modifiés. Ne pas les reproposer sans élément nouveau.

- **Rôle comparé strictement à `'admin'` dans `authentifierAdministrateur` (`src/main.ts`)** : ne pas passer par `normaliserRole()`. Authentification sérialise le rôle par une énumération Rust (`#[serde(rename_all = "lowercase")]`, `src/domain/utilisateur.rs`) qui ne peut produire que `"admin"`, `"moderateur"` ou `"utilisateur"`. Une comparaison stricte est aussi préférable pour décider qui peut se connecter : une variante inattendue doit être refusée, pas acceptée.
- **`viderCache()` avant la vérification de l'identifiant dans `create` (`src/admin/remote-api-resource.ts`)** : quand le service répond avec un succès sans identifiant, l'élément a probablement été créé quand même. La liste en cache est donc périmée et doit être vidée avant de lever l'erreur.
- **Actions GitHub référencées par étiquette (`@v4`) dans `.github/workflows/ci.yml`** : l'épinglage par SHA complique les mises à jour pour un gain faible sur ce projet : `ci.yml` n'utilise aucun secret et tourne avec des permissions en lecture seule. Les autres workflows (`discord.yml`, `claude-review.yml`) manipulent des secrets; la question se reposerait pour eux.
- **`class-methods-use-this: 'error'` dans `.eslintrc.cjs`** : la règle ne demande que trois `eslint-disable-next-line` ciblés et commentés (méthodes imposées par NestJS ou AdminJS). L'option `enforceForClassFields` ne concerne que les champs de classe et ne changerait rien pour ces méthodes.
- **Pas de valeur par défaut pour `optionsRecherche` dans `find` (`src/admin/remote-api-resource.ts`)** : AdminJS appelle toujours `find` avec un objet d'options (`list-action.js`, `search-action.js`). Aucun appelant ne passe `undefined`.
- **`localeCompare` sans locale dans `trier`** : Node embarque l'ICU complet et prend `en-US` par défaut, même dans Alpine avec `LANG` vide ou `LC_ALL=C` (vérifié : `e`, `é`, `z` sont dans le bon ordre). Le tri ne dépend donc pas de la locale du conteneur.
- **`connexion.utilisateur.role` sans chaînage optionnel dans `authentifierAdministrateur`** : une réponse sans `utilisateur` lève une erreur, qui est capturée, journalisée et transformée en refus de connexion. Le comportement est déjà sûr.
- **`as string` sur `this.caches.keys().next().value`** : la condition `size >= tailleMaximaleCache` garantit qu'une entrée existe.
