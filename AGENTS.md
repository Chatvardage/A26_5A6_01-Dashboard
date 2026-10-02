# AGENTS.md — Chatvardage Dashboard

Ce fichier contient les règles de travail pour tout agent IA ou développeur qui modifie ce dépôt. Le code est dans `dashboard-chatvardage/`; le détail du fonctionnement est dans le `README.md`.

## Choix délibérés (ne pas « corriger »)

Ces points ont été relevés en revue et volontairement non modifiés. Ne pas les reproposer sans élément nouveau.

- **Rôle comparé strictement à `'admin'` dans `authentifierAdministrateur` (`src/main.ts`)** : ne pas passer par `normaliserRole()`. Authentification sérialise le rôle par une énumération Rust (`#[serde(rename_all = "lowercase")]`, `src/domain/utilisateur.rs`) qui ne peut produire que `"admin"` ou `"utilisateur"`. Une comparaison stricte est aussi préférable pour décider qui peut se connecter : une variante inattendue doit être refusée, pas acceptée.
- **`viderCache()` avant la vérification de l'identifiant dans `create` (`src/admin/remote-api-resource.ts`)** : quand le service répond avec un succès sans identifiant, l'élément a probablement été créé quand même. La liste en cache est donc périmée et doit être vidée avant de lever l'erreur.
- **Actions GitHub référencées par étiquette (`@v4`) dans `.github/workflows/ci.yml`** : l'épinglage par SHA complique les mises à jour pour un gain faible sur ce projet : `ci.yml` n'utilise aucun secret et tourne avec des permissions en lecture seule. Les autres workflows (`discord.yml`, `claude-review.yml`) manipulent des secrets; la question se reposerait pour eux.
- **`class-methods-use-this: 'error'` dans `.eslintrc.cjs`** : la règle ne demande que trois `eslint-disable-next-line` ciblés et commentés (méthodes imposées par NestJS ou AdminJS). L'option `enforceForClassFields` ne concerne que les champs de classe et ne changerait rien pour ces méthodes.
- **Pas de valeur par défaut pour `optionsRecherche` dans `find` (`src/admin/remote-api-resource.ts`)** : AdminJS appelle toujours `find` avec un objet d'options (`list-action.js`, `search-action.js`). Aucun appelant ne passe `undefined`.
- **`localeCompare` sans locale dans `trier`** : Node embarque l'ICU complet et prend `en-US` par défaut, même dans Alpine avec `LANG` vide ou `LC_ALL=C` (vérifié : `e`, `é`, `z` sont dans le bon ordre). Le tri ne dépend donc pas de la locale du conteneur.
- **`connexion.utilisateur.role` sans chaînage optionnel dans `authentifierAdministrateur`** : une réponse sans `utilisateur` lève une erreur, qui est capturée, journalisée et transformée en refus de connexion. Le comportement est déjà sûr.
- **`as string` sur `this.caches.keys().next().value`** : la condition `size >= tailleMaximaleCache` garantit qu'une entrée existe.
- **Erreur des messages privés propagée, erreur par salon journalisée (`src/admin/resources/messages.ts`)** : cette asymétrie est voulue. Si Message-Service est entièrement tombé, la route des messages privés échoue et l'administrateur voit une erreur explicite au lieu d'une liste vide. L'échec d'un seul salon (par exemple supprimé entre la liste et l'historique) ne doit pas bloquer toute la page. Avaler aussi l'erreur des messages privés masquerait une panne.
- **`expireLe: Number.POSITIVE_INFINITY` pendant une requête en cours (`RessourceApiDistante`)** : c'est la déduplication voulue. L'entrée ne doit pas expirer tant que la promesse partagée n'est pas résolue.
- **`message-destination-property.ts` en `.ts` avec `React.createElement`** : passer en `.tsx` demanderait de configurer `jsx` dans `tsconfig.json` et le bundler AdminJS, pour un seul petit composant.
- **`allowScripts` épinglé sur `esbuild@0.25.12` (`package.json`)** : l'installation ne dépend pas de cette entrée, puisque `npm ci` exécute les scripts d'installation par défaut (voir le `Dockerfile` et le README). Un changement de version d'esbuild ne casse donc pas l'installation. Il suffit de mettre l'entrée à jour en même temps qu'esbuild.
- **Pas de blocage de `fetch` dans `scripts/generate-adminjs.mjs`** : `AdminJS.initialize()` ne fait que générer le bundle des composants. Un appel réseau imprévu échouerait de toute façon pendant le build (aucun service n'est joignable), ce qui ferait échouer l'étape de façon visible.
- **Pas de rôle `moderateur` pour les utilisateurs (`src/admin/resources/utilisateurs.ts`)** : il n'existe plus comme rôle global, seulement dans les serveurs (Room-Service). Le Dashboard ne crée que des comptes `user` ou `admin`, et `normaliserRole()` traite toute autre valeur comme `user`, comme Authentification. Un compte administrateur est d'abord créé comme compte standard (`POST /api/users` ignore le rôle), puis promu par `PATCH /api/users/:id/role`.
- **URL des services lues à l'import des modules (`src/admin/resources/*.ts`)** : `import 'dotenv/config'` est la première instruction de `main.ts`, donc le `.env` est chargé avant ces modules.
- **Pas de contrôle de fraîcheur de `dist/` dans `scripts/generate-adminjs.mjs`** : le script n'est lancé que par le `Dockerfile`, juste après `npm run build`.
- **Image de base `node:22-alpine` non épinglée par digest** : la reproductibilité bit à bit n'est pas exigée. Le tag reçoit les correctifs de sécurité à chaque reconstruction.
- **`ADMIN_JS_SKIP_BUNDLE=true` dans le `Dockerfile`** : la variable est bien lue par AdminJS (`node_modules/adminjs/lib/adminjs.js`). En production, elle empêche de reconstruire au démarrage les bundles déjà générés dans `.adminjs/` à l'étape `builder`.
- **Message de `resoudrePort` qui afficherait `"undefined"`** : ça n'arriverait que si la valeur par défaut `3000` devenait invalide, ce qui est impossible en l'état.
- **`optionsRessource` à paramètres positionnels (`src/admin/resources/commun.ts`)** : il n'y a que quatre appels, tous couverts par les tests de `options.spec.ts`. Passer à un objet de configuration ne changerait pas le comportement.

## Documentation centrale

Infra est la référence du démarrage complet, des architectures, contrats et scénarios de validation. Le README local décrit le dépôt et ses commandes; les guides détaillés sont dans `A26_5A6_01-Infra/docs/`. Toute modification de contrat doit mettre à jour la référence centrale et ses liens.
