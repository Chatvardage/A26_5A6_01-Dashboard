import { performance } from 'node:perf_hooks';

import type { RequestHandler } from 'express';

// Une instance de Dashboard : dix tentatives par minute et par adresse.
// Le trust proxy à un saut exige que seul le proxy HTTPS contrôlé puisse joindre le port.
export function limiterConnexions(maintenant: () => number = () => performance.now()): RequestHandler {
  const tentatives = new Map<string, { nombre: number; expiration: number }>();
  return (requete, reponse, suite) => {
    if (requete.method !== 'POST' || !/^\/login\/?$/i.test(requete.path)) {
      suite();
      return;
    }
    const instant = maintenant();
    // Fenêtres fixes et horloge monotone : l'ordre d'insertion est celui des
    // expirations. Ne parcourir que les entrées expirées, pas tous les compteurs.
    // eslint-disable-next-line no-restricted-syntax -- itérateur natif Node 22; arrêt à la première fenêtre active.
    for (const [cle, compteur] of tentatives) {
      if (compteur.expiration > instant) break;
      tentatives.delete(cle);
    }
    const adresse = requete.ip || requete.socket.remoteAddress;
    if (!adresse) {
      reponse.setHeader('Retry-After', '60');
      reponse.status(429).end();
      return;
    }
    let compteur = tentatives.get(adresse);
    if (!compteur) {
      if (tentatives.size >= 10_000) {
        reponse.setHeader('Retry-After', '60');
        reponse.status(429).end();
        return;
      }
      compteur = { nombre: 0, expiration: instant + 60_000 };
      tentatives.set(adresse, compteur);
    }
    if (compteur.nombre >= 10) {
      reponse.setHeader('Retry-After', String(Math.ceil((compteur.expiration - instant) / 1000)));
      reponse.status(429).end();
      return;
    }
    compteur.nombre += 1;
    suite();
  };
}
