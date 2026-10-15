# Standalone Gearbox

**FiveM · Auto / Sequential · Version 0.3.2**

[English](#english) · [Français](#français)

<a id="english"></a>
## English

An independent automatic and sequential gearbox for FiveM, with native engine audio, an optional HUD, manual Neutral/Reverse in Sequential mode, and keyboard + wheel/controller bindings each player can rebind. No ESX, QBCore, database or other gearbox resource is required.

### Demo

[▶ Watch the demonstration on YouTube](https://youtu.be/pgyUvUh0WwE)

### Features

- **Auto or Sequential:** choose the server default and allow drivers to switch, or lock the chosen mode.
- **Manual Neutral and Reverse in Sequential mode:** shift down through `1 → N → R` and shift up through `R → N → 1` without speed thresholds; Neutral stays decoupled when revving or braking, and Reverse stays engaged until a manual upshift.
- **Independent keyboard and wheel/controller controls:** rebind keyboard keys and steering-wheel paddles / controller buttons separately in FiveM's key-binding settings.
- **Automatic vehicle coverage:** eligible motorized road vehicles are handled without a model-by-model setup, including unlisted add-ons.
- **Server-side permissions:** allow every driver, selected identifiers, ACE permissions or framework jobs to change mode.
- **Optional HUD and public API:** use the included display or send the logical gear (`1..N`, `N`, `R`) and mode to your own HUD.
- **English and French:** select the player-facing language in `config.js`; configuration comments are in English.

### Installation

1. Use an up-to-date FXServer with **OneSync enabled**.
2. Download **`standalone_gearbox-0.3.2.zip`** from the [v0.3.2 release](https://github.com/DailyMok/FiveM-Gearbox/releases/tag/v0.3.2).
3. Extract the ready-to-install **`standalone_gearbox`** folder. If using **Code → Download ZIP** instead, rename `FiveM-Gearbox-main` to `standalone_gearbox`.
4. Place it in `resources/[standalone]/standalone_gearbox`. The `fxmanifest.lua` file must be directly inside that folder.
5. Add this to `server.cfg`:

   ```cfg
   ensure standalone_gearbox
   ```

6. Adjust the configuration below, then start or restart the resource during a maintenance window.

No npm installation, build step, SQL import or external web service is needed. Keep the resource folder named `standalone_gearbox`.

### Configuration

| File | What to configure |
|---|---|
| [`config.js`](config.js) | Language, HUD, vehicle coverage, default mode, mode switching, default keyboard/device keys and optional sound |
| [`vehicle-profiles.js`](vehicle-profiles.js) | Optional exceptions by model hash or spawn name |
| [`server/permissions.js`](server/permissions.js) | Who can change mode: everyone, identifiers, ACE or jobs |

Defaults: `locale: 'en'`, HUD enabled, `vehicles: 'all'`, `defaultMode: 'auto'`, and mode switching allowed for every driver. Use `locale: 'fr'` for French, `hud: false` for your own HUD, or `allowModeSwitch: false` to lock the configured default.

**You do not need to list every vehicle.** Coverage uses the native vehicle type/class and transmission data. Profiles are for exceptions; `vehicles: 'selected'` is available if you deliberately want an allowlist. Boats, aircraft, trains, pedal bicycles and trailers remain outside the road gearbox's scope. Invalid transmission data or unavailable natives can prevent activation on an add-on.

See the [administrator guide](docs/ADMIN-CONFIG.md) for examples and the [vehicle coverage guide](docs/COVERAGE.md) for supported categories. Keep private player identifiers in the server-only permissions file.

### Controls

| Action | Default key |
|---|---|
| Toggle Auto / Sequential | M |
| Shift up in Sequential | Page Up |
| Shift down in Sequential | Page Down |

All three keyboard controls and three additional **Wheel / controller:** controls (unbound by default) appear under **Settings → Key Bindings → FiveM**. Each player can change them independently. Changing server defaults does not overwrite a player's saved bindings. See the [wheel/controller guide](docs/INPUT-DEVICES.md) and the [manual Neutral/Reverse guide](docs/MANUAL-NEUTRAL-REVERSE.md).

Commands: `/sgbox auto`, `/sgbox seq`, `/sgbox toggle`, `/sgbox up`, `/sgbox down` and `/sgbox info`. The command name is configurable.

Normal player mode switching requires a **networked vehicle** so the server can authorize the request. Local vehicles cannot switch mode through these controls. See the [integration guide](docs/INTEGRATION.md) for vehicle spawners.

A vehicle keeps its mode when its driver changes. The mode resets when the entity is deleted or the resource restarts; it is not saved by plate.

### Your own HUD

Set `hud: false` to hide the included HUD. The client export and local event remain available:

```js
const state = exports['standalone_gearbox'].getHudState();
// state.gear: logical gear, 'N', 'R', or null
// state.displayGear: display-ready gear, 'D', 'N', 'R', or null
// state.mode: 'auto', 'seq', or null
```

```lua
AddEventHandler('standalone_gearbox:state', function(state)
    -- Connect these values to your own HUD.
    local currentGear = state.displayGear
    local currentMode = state.mode
end)
```

Use the API's logical gear rather than GTA's native current gear. Handle the inactive state and resource stop to clear your display. See the [complete HUD API](docs/HUD-API.md) for field definitions and integration examples.

### Audio, compatibility and validation

No shift-sound recordings are shipped. Optional shift sounds are disabled; native engine audio and the brief throttle cut during shifts remain. You can add your own permitted recordings using the [audio guide](docs/SHIFT-FEEDBACK.md).

Avoid running competing gearbox or handling controllers on the same vehicle. Use model exclusions, `conflictingResources` or the [integration API](docs/INTEGRATION.md).

Version 0.3.2 passed **342 automated tests with simulated FiveM natives**, including sequential Neutral/Reverse, wheel/controller button mappings and the local-vehicle regression. Complete the [in-game acceptance checklist](docs/VALIDATION.md) on your server before deployment.

### License

The [DailyMok Free Use and No Resale License](LICENSE) permits use, modification and **free redistribution**, including use on monetized FiveM servers (VIP, donations and shops). **Selling the mod, a modified version or a paid pack containing it is prohibited.** Keep the copyright, license and third-party notices when sharing it. This is a custom source-available license, not MIT.

[Release notes](docs/CHANGELOG.md) · [Third-party notices](docs/THIRD-PARTY-NOTICES.md)

---

<a id="français"></a>
## Français

Une boîte de vitesses automatique et séquentielle autonome pour FiveM, avec audio moteur natif, HUD facultatif, sélection manuelle du point mort (`N`) et de la marche arrière (`R`) en mode séquentiel, et touches clavier + volant/manette personnalisables par chaque joueur. Aucun framework ESX/QBCore, base de données ou autre mod de boîte n'est nécessaire.

### Démonstration

[▶ Voir la démonstration sur YouTube](https://youtu.be/pgyUvUh0WwE)

### Fonctionnalités

- **Auto ou Séquentielle :** choisir le mode par défaut du serveur et autoriser son changement, ou verrouiller le mode choisi.
- **Point mort (`N`) et marche arrière (`R`) manuels en Séquentielle :** rétrograder via `1 → N → R` et monter via `R → N → 1` sans seuil de vitesse ; le point mort reste engagé à l'accélération ou au freinage, et la marche arrière reste maintenue jusqu'au passage supérieur manuel.
- **Touches clavier et volant/manette indépendantes :** affecter séparément le clavier et les palettes/boutons de volant ou manette depuis les paramètres FiveM.
- **Prise en charge automatique :** les véhicules routiers motorisés admissibles sont reconnus sans configuration modèle par modèle, y compris les add-ons absents du catalogue.
- **Permissions côté serveur :** autoriser tous les conducteurs, certains identifiants, une permission ACE ou des métiers à changer de mode.
- **HUD facultatif et API publique :** utiliser l'affichage intégré ou récupérer le rapport logique (`1..N`, `N`, `R`) et le mode dans votre propre HUD.
- **Anglais et français :** choisir la langue des textes joueurs dans `config.js` ; les commentaires de configuration sont en anglais.

### Installation

1. Utiliser un FXServer à jour avec **OneSync activé**.
2. Télécharger **`standalone_gearbox-0.3.2.zip`** depuis la [release v0.3.2](https://github.com/DailyMok/FiveM-Gearbox/releases/tag/v0.3.2).
3. Extraire le dossier **`standalone_gearbox`**, prêt à installer. Si vous utilisez plutôt **Code → Download ZIP**, renommer `FiveM-Gearbox-main` en `standalone_gearbox`.
4. Le placer dans `resources/[standalone]/standalone_gearbox`. Le fichier `fxmanifest.lua` doit se trouver directement dans ce dossier.
5. Ajouter dans `server.cfg` :

   ```cfg
   ensure standalone_gearbox
   ```

6. Ajuster la configuration ci-dessous, puis démarrer ou redémarrer la ressource pendant une maintenance.

Aucune installation npm, compilation, importation SQL ou connexion à un service web externe n'est nécessaire. Conserver le nom de dossier `standalone_gearbox`.

### Configuration

| Fichier | Réglages |
|---|---|
| [`config.js`](config.js) | Langue, HUD, véhicules concernés, mode par défaut, changement de mode, touches clavier/périphériques par défaut et son facultatif |
| [`vehicle-profiles.js`](vehicle-profiles.js) | Exceptions facultatives par hash ou nom de spawn |
| [`server/permissions.js`](server/permissions.js) | Qui peut changer de mode : tous, identifiants, ACE ou métiers |

Par défaut : `locale: 'en'`, HUD actif, `vehicles: 'all'`, `defaultMode: 'auto'` et changement de mode autorisé à tous les conducteurs. Utiliser `locale: 'fr'` pour le français, `hud: false` pour votre propre HUD, ou `allowModeSwitch: false` pour verrouiller le mode par défaut configuré.

**Il n'est pas nécessaire de lister chaque véhicule.** La détection utilise le type, la catégorie et les données de transmission natives. Les profils servent aux exceptions ; `vehicles: 'selected'` permet de choisir volontairement une liste de modèles autorisés. Bateaux, aéronefs, trains, vélos à pédales et remorques restent hors du périmètre de cette boîte routière. Des données de transmission invalides ou des natives indisponibles peuvent empêcher l'activation sur un add-on.

Le [guide administrateur](docs/ADMIN-CONFIG.md) fournit les exemples et le [guide des véhicules](docs/COVERAGE.md) détaille les catégories prises en charge. Conserver les identifiants privés des joueurs dans le fichier de permissions réservé au serveur.

### Touches et commandes

| Action | Touche par défaut |
|---|---|
| Alterner Auto / Séquentielle | M |
| Monter un rapport en Séquentielle | Page Up |
| Descendre un rapport en Séquentielle | Page Down |

Les trois actions clavier et les trois lignes **Volant / manette :** (libres par défaut) apparaissent dans **Paramètres → Raccourcis clavier → FiveM**. Chaque joueur peut les modifier indépendamment. Un changement des touches par défaut côté serveur ne remplace pas les préférences déjà sauvegardées. Voir le [guide des périphériques](docs/INPUT-DEVICES.md#français--affecter-vos-palettes-ou-boutons) et le [guide N / R](docs/MANUAL-NEUTRAL-REVERSE.md).

Commandes : `/sgbox auto`, `/sgbox seq`, `/sgbox toggle`, `/sgbox up`, `/sgbox down` et `/sgbox info`. Le nom de la commande est configurable.

Le changement de mode normal par un joueur nécessite un **véhicule réseau**, afin que le serveur puisse autoriser la demande. Ces commandes ne permettent pas de changer le mode d'un véhicule local. Voir le [guide d'intégration](docs/INTEGRATION.md) pour les outils de création de véhicules.

Un véhicule conserve son mode lors d'un changement de conducteur. Ce mode est réinitialisé lorsque l'entité est supprimée ou que la ressource redémarre ; il n'est pas sauvegardé par plaque.

### Votre propre HUD

Mettre `hud: false` masque le HUD intégré. L'export client et l'événement local restent disponibles :

```js
const state = exports['standalone_gearbox'].getHudState();
// state.gear: logical gear, 'N', 'R', or null
// state.displayGear: display-ready gear, 'D', 'N', 'R', or null
// state.mode: 'auto', 'seq', or null
```

```lua
AddEventHandler('standalone_gearbox:state', function(state)
    -- Connect these values to your own HUD.
    local currentGear = state.displayGear
    local currentMode = state.mode
end)
```

Utiliser le rapport logique de l'API plutôt que le rapport natif GTA. Gérer l'état inactif et l'arrêt de la ressource pour effacer l'affichage. Le [contrat API complet](docs/HUD-API.md) décrit les champs et les exemples d'intégration.

### Audio, compatibilité et vérification

Aucun enregistrement de passage de rapport n'est fourni. Les sons de passage facultatifs sont désactivés ; l'audio moteur natif et la brève coupure d'accélérateur pendant les passages sont conservés. Le [guide audio](docs/SHIFT-FEEDBACK.md) permet d'ajouter vos propres enregistrements autorisés.

Éviter de faire fonctionner plusieurs contrôleurs de boîte ou de comportement sur un même véhicule. Utiliser les exclusions par modèle, `conflictingResources` ou l'[API d'intégration](docs/INTEGRATION.md).

La version 0.3.2 a passé **342 tests automatiques avec des natives FiveM simulées**, incluant la sélection séquentielle `N`/`R`, les affectations volant/manette et le test de régression des véhicules locaux. Suivre la [fiche de validation en jeu](docs/VALIDATION.md) sur votre serveur avant la mise en service.

### Licence

La [licence DailyMok Free Use and No Resale](LICENSE) autorise l'utilisation, la modification et le **partage gratuit**, y compris sur des serveurs FiveM monétisés (VIP, dons et boutiques). **La vente du mod, d'une version modifiée ou d'un pack payant qui le contient est interdite.** Conserver les mentions d'auteur, la licence et les mentions des éléments tiers lors du partage. Il s'agit d'une licence personnalisée avec code consultable, pas d'une licence MIT. Le texte anglais du fichier LICENSE fait foi.

[Notes de version](docs/CHANGELOG.md) · [Provenance des éléments tiers](docs/THIRD-PARTY-NOTICES.md) · [README français séparé](README.fr.md)
