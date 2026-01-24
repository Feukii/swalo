# SWALO - Cahier des charges technique (resume)

Ce document est un resume du cahier technique offline-first pour reduire la taille du repo.

## Objectif

Construire un mini-ERP retail mobile-first, utilisable par ~10 boutiques avec un cout infra proche de 0.

## Principes clefs

- Offline obligatoire pour toutes les operations metier
- Sync opportuniste via une API `/sync` (push/pull delta)
- Resolution de conflits deterministe par domaine
- Monolithe modulaire (modules metier separes)
- Donnees locales: SQLite (mobile) + IndexedDB (web)

## Stack cible

- Mobile: React Native + Expo + WatermelonDB (SQLite)
- Web: React + RxDB (IndexedDB)
- Backend: NestJS (ou FastAPI) + PostgreSQL
- Hebergement gratuit: Supabase / Render / Cloudflare

## Securite

- JWT pour l'authentification
- Chiffrement au repos (SQLCipher mobile)
- Stockage des cles dans Keychain/Keystore

## Modules fonctionnels (MVP)

- Caisse / ventes
- Inventaire / stocks
- Facturation
- Fournisseurs (credits, echeances)
- Clients / credits
- Rapports / dashboards

## UX

- Mobile-first
- Parcours tres courts (2-3 actions)
- Latence percue faible

## Note

Pour les specifications completes, voir `SWALO_Cahier_des_Charges_Unifie.md`.
