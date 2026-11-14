# Spécification produit — Commander Pocket

## Vision
Application iOS/Android pour jouer à Commander à quatre joueurs, en présentiel autour d'un réseau local ou en solo. L'app gère les règles et l'état de partie, facilite la consultation des cartes et rend visibles les priorités et déclenchements sans remplacer les décisions Magic par une automatisation opaque.

## Plateformes et orientation
- Cible principale : téléphones 5,5 à 6,7 pouces ; iOS et Android.
- Plateau de partie en paysage obligatoire pour exposer quatre zones joueurs.
- Main, recherche, modales et tiroir de pile peuvent utiliser une présentation verticale/feuille inférieure.
- Interface compacte : compteurs, piles regroupées, badges d'état et arbre d'attachements au long appui.
- Barre de télémétrie persistante : vies, cartes en main, taxe de commandant, mana et priorité.
- Radar adverse / geste hold-and-slide pour consulter un plateau sans perdre le contexte de la main.
- Tiroir inférieur pour pile, déclenchements, réponses et macros de résolution.
- Accessibilité : WUBRG non distingué par couleur seule ; formes, motifs, libellés, contraste, VoiceOver et TalkBack.

## Modes
1. Partie locale sur un appareil : plusieurs joueurs autour du même écran, avec contrôle des informations privées.
2. Réseau local : un hôte crée la salle, les autres rejoignent depuis le même réseau ; quatre sièges.
3. Solo : adversaires IA, tutoriel et scénarios.
4. Consultation : recherche, détail multi-faces, decklists et collection.

## Règles et intégrité
- Moteur commun aux modes solo, local et LAN.
- Le serveur LAN est autoritaire ; les clients envoient des commandes et reçoivent des vues filtrées.
- Chaque commande est versionnée, authentifiée, idempotente et vérifiée contre la révision.
- Les règles non prises en charge sont signalées ; aucune résolution silencieuse ou approximation cachée.
- Données de cartes alignées sur le modèle Scryfall, y compris layouts multi-faces.
- Référence des règles : Comprehensive Rules fournies, édition du 25 septembre 2026, plus règles/banlist Commander courantes.

## Principaux flux
- Créer/importer un deck et valider taille, singleton, identité couleur, légalité et commandant.
- Créer une salle LAN ou rejoindre avec un jeton de siège.
- Préparer commandants, bibliothèques, mulligans et mains.
- Progresser phase/étape et priorité, jouer sorts/capacités, choisir cibles et coûts.
- Résoudre la pile, déclenchements et actions basées sur un état.
- Reprendre une partie après perte réseau et consulter l'historique.
- Solo : même moteur, adversaire IA proposant des commandes légales.

## Non-objectifs initiaux
- Pas de serveur mondial public avant que le LAN soit fiable.
- Pas d'exécution automatique de texte Oracle arbitraire.
- Pas de copie locale de bases de cartes/images sans vérifier licence et provenance.
- Pas de portage natif Rust avant profilage.

## Critères d'acceptation de la première version jouable
- Quatre sièges peuvent importer/choisir un deck Commander et commencer.
- Chaque joueur ne voit que sa main et ses informations privées.
- Tour complet : priorité, sort, réponse, pile, résolution, SBA, combat et nettoyage.
- Hôte et clients peuvent se déconnecter/reconnecter sans divergence.
- Une partie peut être sauvegardée et rejouée depuis un journal versionné.
- Les règles non prises en charge sont bloquantes ou explicitement signalées.
- Tests automatisés moteur/protocole/données et validation sur appareils iOS/Android.
