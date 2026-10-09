
## Renforcement sécurité — 9 octobre 2026

La connexion AdminJS est limitée à dix tentatives par minute et par IP (maximum 10 000 compteurs, HTTP 429 au-delà). En production/staging, le cookie est obligatoirement HTTPS, HttpOnly, SameSite strict et expire après trente minutes. Le port doit rester accessible uniquement depuis le reverse proxy contrôlé (`trust proxy` à un saut).

L'image finale utilise le bundle précompilé, retire le binaire esbuild et npm/npx. L'extension de liens Tiptap et le backend HTTP i18next sont mis à jour; l'override YAML concerne seulement l'outil de couverture.

### Limites connues

La migration vers Jest 30 et typescript-eslint 8 supprime braces du verrou : npm audit ne contient plus d’avis high ou critical et le seuil CI reste inchangé.

[Tiptap core GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh) exige une migration majeure vers Tiptap 3.30.4+. AdminJS utilise Tiptap 2; ne pas forcer ce changement isolément dans sa chaîne React. Les ressources actuelles n'importent pas de documents riches ou d'objets d'attributs non fiables; toute activation future d'un éditeur/import doit d'abord remplacer cette chaîne. Voir [rapport initial Infra](https://github.com/Chatvardage/A26_5A6_01-Infra/blob/develop/docs/audit-securite-2026-10-09.md).
