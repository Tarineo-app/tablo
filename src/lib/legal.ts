/**
 * Identité de l'éditeur, utilisée par toutes les pages légales.
 * À COMPLÉTER par Alann : tant qu'une valeur commence par « [ », la page l'affiche surlignée.
 */
export const EDITEUR = {
  nom: "[Prénom et nom de l'entrepreneur]",
  statut: "Entrepreneur individuel (micro-entreprise)",
  marque: "Tablo",
  adresse: "[Adresse de domiciliation]",
  siret: "[Numéro SIRET]",
  tva: "[Numéro de TVA intracommunautaire, ou « TVA non applicable, article 293 B du CGI »]",
  email: process.env.CONTACT_EMAIL || "[Email de contact]",
  tribunal: "[Ville du tribunal compétent, celle du siège de l'éditeur]",
  site: "https://tablo-club.vercel.app",
};

/** Garantie et prix affichés dans les CGV (les mêmes que la configuration guidée). */
export const PRIX_MENSUEL = "200 €";
export const GARANTIE_JOURS = 30;
export const MISE_A_JOUR = "25 novembre 2026";

export const isTodo = (v: string) => v.startsWith("[");
