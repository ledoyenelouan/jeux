# Patrouille de Nuit – Prototype Web

Prototype jouable d’un jeu d’action-aventure mobile inspiré d’une patrouille nocturne de la Police Municipale de La Crau. L’expérience se concentre sur l’orientation paysage, l’aide aux civils et la gestion des dangers dans un défilement horizontal.

## Fonctionnalités principales

- Orientation paysage obligatoire : en mode portrait, un écran dédié bloque les interactions.
- 4 niveaux biomes (Centre-ville, Docks, Banlieue, Zone industrielle) avec progression verrouillée/déverrouillée.
- Objectifs : aider tous les civils, atteindre la porte du commissariat, obtenir au moins 60 % du score de référence et conserver une vie.
- Collecte de bonus (score, médikits, bouclier) et gestion des ennemis via neutralisation douce.
- HUD complet (score, vies, civils aidés) et commandes tactiles configurables (flèches ou joystick virtuel, mode gaucher, taille des boutons, sensibilité).
- Options persistantes (musique, commandes, statistiques, niveaux débloqués) stockées en local.
- Menus dédiés : principal, sélection de niveaux, statistiques, options in-game/menu.

## Lancer le prototype

1. Ouvrir `index.html` dans un navigateur moderne (Chrome, Firefox, Safari, Edge).
2. Passer le périphérique en orientation paysage (ou réduire la fenêtre pour simuler un smartphone couché).
3. Utiliser les contrôles tactiles à l’écran ou le clavier (← → pour se déplacer, ↑ ou espace pour sauter, **E** pour interagir, **Q** pour neutraliser).

> 💡 Sur mobile, ajouter la page à l’écran d’accueil permet d’obtenir un rendu plein écran.

## Développement

- Code source : `index.html`, `style.css`, `game.js`.
- Aucun serveur requis – tout est géré côté client.
- Les préférences et statistiques sont enregistrées via `localStorage` (clé `patrouille_nuit_save`).

## Licence

Prototype réalisé à des fins de démonstration. Utilisation libre sous réserve de citer la source.
