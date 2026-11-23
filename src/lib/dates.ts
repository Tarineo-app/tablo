/** Hier à la même heure : sert à masquer les soirées passées. */
export const yesterday = () => new Date(Date.now() - 864e5);

/** Soirées « en cours » : de la veille à demain midi (pour le contrôle à l'entrée). */
export const tonight = () => ({ gte: new Date(Date.now() - 864e5), lte: new Date(Date.now() + 432e5) });

/** Demain à la même heure : borne haute pour les statistiques. */
export const tomorrow = () => new Date(Date.now() + 864e5);

/** Instant courant, isolé ici pour que les pages restent « pures ». */
export const now = () => new Date();
