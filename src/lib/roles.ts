import type { Role } from "@/generated/prisma/enums";

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Propriétaire",
  DIRECTOR: "Directeur",
  MANAGER: "Manager commercial",
  SERVER: "Serveur",
  BARMAN: "Barman",
};

export const ROLE_DESC: Record<Role, string> = {
  OWNER: "Tous les droits, y compris l'abonnement.",
  DIRECTOR: "Configure le club, voit toutes les réservations, gère l'équipe.",
  MANAGER: "A son lien de réservation, voit ses clients et ses ventes.",
  SERVER: "Voit les envois de la soirée et les sert.",
  BARMAN: "Voit les envois à préparer au bar.",
};

/** Rôles qu'on peut donner en invitant quelqu'un. */
export const INVITABLE: Role[] = ["DIRECTOR", "MANAGER", "SERVER", "BARMAN"];

export const isManagement = (r: Role) => r === "OWNER" || r === "DIRECTOR";
export const isFloor = (r: Role) => r === "SERVER" || r === "BARMAN";
