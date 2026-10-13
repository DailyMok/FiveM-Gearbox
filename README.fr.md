# Standalone Gearbox — 0.3.0

Boîte de vitesses automatique/séquentielle autonome pour FiveM, avec HUD facultatif, trois touches réaffectables, permissions serveur et API pour votre propre HUD. Aucun framework RP, base de données ou autre mod de boîte n'est nécessaire.

[▶ Voir la démonstration sur YouTube](https://youtu.be/pgyUvUh0WwE)

## Installation

1. Télécharger **`standalone_gearbox-0.3.0.zip`** depuis la [release v0.3.0](https://github.com/DailyMok/FiveM-Gearbox/releases/tag/v0.3.0), puis extraire son dossier `standalone_gearbox`. Copier ce dossier dans les ressources du serveur, par exemple `resources/[standalone]/standalone_gearbox`. Si vous utilisez plutôt **Code → Download ZIP**, renommer le dossier extrait `FiveM-Gearbox-main` en `standalone_gearbox`.
2. Utiliser un FXServer à jour avec OneSync activé.
3. Ajouter `ensure standalone_gearbox` dans `server.cfg`. Conserver ce nom de dossier.
4. Modifier la configuration puis redémarrer la ressource pendant une maintenance.

Aucune installation npm, compilation ou importation SQL n'est nécessaire.

## Trois fichiers de configuration

| Fichier | Utilisation |
|---|---|
| `config.js` | Langue, HUD, véhicules concernés, mode par défaut, changement de mode, touches et son |
| `vehicle-profiles.js` | Exceptions facultatives par hash ou nom de spawn |
| `server/permissions.js` | Changement de mode pour tous, certains identifiants, une permission ACE ou des métiers |

Les fichiers `config.js` et `vehicle-profiles.js` sont directement à la racine du dépôt et de la ressource ; les permissions se trouvent dans `server/permissions.js`.

Par défaut : anglais, HUD actif, tous les véhicules routiers motorisés admissibles, mode Auto, changement de mode autorisé à tous les conducteurs. Pour les textes en français, mettre **`locale: 'fr'`** dans `config.js`. Les commentaires des fichiers de configuration restent en anglais.

**Il n'est pas nécessaire de lister chaque véhicule.** Avec `vehicles: 'all'`, le mod utilise automatiquement les catégories/types et les données de transmission GTA, y compris pour les add-ons absents du catalogue. Les profils individuels servent aux exceptions. Le mode `vehicles: 'selected'` permet volontairement de limiter la ressource à une liste de modèles.

Bateaux, aéronefs, trains, vélos à pédales et remorques ne sont pas pris en charge par cette boîte routière. Des données de transmission invalides ou une native incompatible peuvent empêcher l'activation sur un add-on.

Exemple d'exceptions :

```js
globalThis.StandaloneGearboxVehicleProfiles = {
  adder: { defaultMode: 'seq' },
  my_custom_vehicle: { enabled: false }
};
```

On peut remplacer `adder` par son hash `'3078201489'`. Choisir une seule entrée par modèle. Pour exclure un véhicule, `enabled: false` suffit. Pour un défaut séquentiel global : `defaultMode: 'seq'`. Pour interdire tout changement joueur : `allowModeSwitch: false`.

Les permissions avancées sont exclusivement dans `server/permissions.js` : `everyone`, `identifiers`, `ace` ou `jobs`. Les adaptateurs métiers proposés sont ESX, QBCore et une fonction serveur personnalisée. Ne jamais placer les identifiants privés dans les fichiers partagés. Le [guide administrateur](docs/ADMIN-CONFIG.md) fournit les exemples complets en anglais.

## Commandes et touches

| Action | Touche par défaut |
|---|---|
| Alterner Auto / Séquentielle | M |
| Monter un rapport | Page Up |
| Descendre un rapport | Page Down |

Les trois actions apparaissent dans **Paramètres → Raccourcis clavier → FiveM**. Chaque joueur peut les modifier. Une nouvelle touche par défaut côté serveur ne remplace pas une préférence déjà sauvegardée.

Commandes : `/sgbox auto`, `/sgbox seq`, `/sgbox toggle`, `/sgbox up`, `/sgbox down`, `/sgbox info`.

Le mode appartient au véhicule vivant et suit le changement de conducteur. Il repart au défaut après suppression de l'entité ou redémarrage de la ressource ; aucune sauvegarde par plaque n'est incluse.

Le son de passage est désactivé par défaut. La brève coupure d'accélérateur lors du passage est indépendante du son. Voir les [réglages audio et leur provenance](docs/SHIFT-FEEDBACK.md).

## HUD personnalisé

Mettre `hud: false` masque uniquement le HUD intégré. L'export client `getHudState()` et l'événement local `standalone_gearbox:state` restent disponibles :

```lua
AddEventHandler('standalone_gearbox:state', function(state)
    local rapportActuel = state.gear
    local rapportAffiche = state.displayGear
    local modeActuel = state.mode -- 'auto', 'seq' or nil
    -- Connect these values to your own HUD.
end)
```

Utiliser ces rapports logiques, pas le rapport natif GTA. Le [contrat API](docs/HUD-API.md) décrit les champs, la marche arrière, les états inactifs et les exemples JS/Lua.

## Vérification sur votre serveur

Les tests automatiques utilisent des natives simulées. Ils ne remplacent pas un essai FiveM, ni un essai des versions ESX/QBCore réellement installées. Vérifier au minimum les deux modes, les touches, un changement de conducteur, les permissions, le HUD masqué et les véhicules spécifiques du serveur.

Pour éviter les conflits avec une autre boîte, utiliser les exclusions par modèle ou les [exports d'intégration](docs/INTEGRATION.md). La [fiche de validation](docs/VALIDATION.md) détaille les limites et les essais attendus.

[Notes de version](docs/CHANGELOG.md) · [Provenance des éléments tiers](docs/THIRD-PARTY-NOTICES.md)
