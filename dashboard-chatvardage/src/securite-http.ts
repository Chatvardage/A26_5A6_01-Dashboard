import type { RequestHandler } from 'express';

// Une instance de Dashboard : dix tentatives par minute et par adresse.
// Le trust proxy à un saut exige que seul le proxy HTTPS contrôlé puisse joindre le port.
export function limiterConnexions(maintenant: () => number = Date.now): RequestHandler {
  const tentatives = new Map<string, { nombre: number; expiration: number }>();
  return (requete, reponse, suite) => {
    if (requete.method !== 'POST' || !/^\/login\/?$/i.test(requete.path)) {
      suite();
      return;
    }
    const instant = maintenant();
    // Nettoyage sans minuterie persistante; les adresses ne peuvent pas remplir la mémoire.
    tentatives.forEach((compteur, adresse) => {
      if (compteur.expiration <= instant) tentatives.delete(adresse);
    });
    const adresse = requete.ip ?? requete.socket.remoteAddress ?? 'inconnue';
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
