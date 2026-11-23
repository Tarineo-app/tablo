/** Hier à la même heure : sert à masquer les soirées passées. */
export const yesterday = () => new Date(Date.now() - 864e5);

/** Soirées « en cours » : de la veille à demain midi (pour le contrôle à l'entrée). */
export const tonight = () => ({ gte: new Date(Date.now() - 864e5), lte: new Date(Date.now() + 432e5) });
