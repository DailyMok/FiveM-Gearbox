# Wheel, paddle and controller buttons

**Version 0.3.2** adds dedicated wheel, paddle and controller button mappings alongside the existing keyboard controls.

## English: assign your buttons

Version 0.3.2 adds three independent FiveM actions for a wheel, paddle or controller button: shift up, shift down and Auto/Sequential. They start unbound. Your existing M, Page Up and Page Down assignments remain separate, so a keyboard key and a device button can control the same action without keyboard emulation.

1. Join a server running version 0.3.2, with your device connected and recognized by FiveM.
2. Open **Settings → Key Bindings → FiveM**.
3. Find the Gearbox entries labelled **Wheel / controller:**. Assign the upshift entry to one paddle/button, the downshift entry to another, and the mode entry to a button if wanted.
4. Enter a supported networked vehicle. Switch to Sequential, then test one upshift and one downshift at low speed. Mode changes still follow server permissions. Use the same settings screen to change or remove an assignment later.

Labels follow the server's `locale` setting. An action left unbound does nothing until assigned. FiveM must recognize the input as a usable button; this resource does not add a device driver or make unsupported hardware visible to the game.

If a paddle was already assigned to an older Gearbox entry, remove that old paddle assignment when moving it to a **Wheel / controller** entry. Keep each button on one entry only. Identical actions arriving from both mapping groups in the same game frame are collapsed into one request; this does not remove stored duplicate bindings or prevent conflicts between different actions.

The registered mapper selects a **default binding**, not a filter on FiveM's native capture screen. That screen can still capture another connected device or an axis. Selecting `JOYSTICK_BUTTON` in the server configuration does not block that behavior. The previously reported native rebinding-menu issue remains unresolved; these additional actions do not establish a fix for it.

## Optional first assignment through F8

Use this only if the device action is **currently unbound** and you know the button ID FiveM reports. The following is an example, not a wheel-specific preset:

```text
rbind standalone_gearbox JOYSTICK_BUTTON IOM_JOYSTICK_BUTTON5 "+sgbox_device_up"
rbind standalone_gearbox JOYSTICK_BUTTON IOM_JOYSTICK_BUTTON6 "+sgbox_device_down"
```

Button numbers depend on the hardware. Replace `5` and `6` with your actual button IDs. The dedicated mode command is `+sgbox_device_toggle` if you want a third assignment. These device command names are fixed; changing `config.js`'s `command` setting changes only the chat command.

`rbind` adds an assignment; it does not replace every existing assignment to an action. Do not repeat this procedure to change buttons or use it on an already-bound action. Make later changes and removals through the native FiveM settings. See the official [client console commands](https://docs.fivem.net/docs/client-manual/console-commands/#rbind-resource-mapper-input-command) for `rbind`.

## Server defaults

In `config.js`, leave the extra controls unbound unless your server needs a shared starting preset:

```js
deviceKeys: {
  mapper: 'JOYSTICK_BUTTON',
  up: '',
  down: '',
  toggle: ''
},
```

`deviceKeys` is separate from the existing `keys` object. An empty string means no default button. A player's saved assignments take precedence over server defaults; restarting the resource does not reset them.

| Mapper | Accepted default parameters | Example |
|---|---|---|
| `JOYSTICK_BUTTON` | `IOM_JOYSTICK_BUTTON1` through `IOM_JOYSTICK_BUTTON32` | `up: 'IOM_JOYSTICK_BUTTON5'` |
| `PAD_DIGITALBUTTON` | FiveM's named digital pad parameters | `up: 'R1_INDEX', down: 'L1_INDEX'` |

The mapper applies to all three device defaults. For a pad preset, set `mapper: 'PAD_DIGITALBUTTON'` and use its matching names. See Cfx's [joystick button parameters](https://docs.fivem.net/docs/game-references/input-mapper-parameter-ids/joystick_button/) and [pad button parameters](https://docs.fivem.net/docs/game-references/input-mapper-parameter-ids/pad_digitalbutton/). These examples do not prescribe a physical paddle layout for any particular wheel.

## Scope

This feature sends button presses through native FiveM mappings to the existing gearbox actions. It does not add raw steering/pedal axes, force feedback, an H-pattern shifter, clutch simulation or a selector for a particular physical device. If multiple devices report the same button mapping, this resource cannot choose between them by hardware ID.

Keyboard and device mappings are separate, but both invoke the same gearbox logic and mode authorization. They do not bypass vehicle eligibility, shift safeguards or mode-change permissions. Hardware recognition and actual in-game behavior still need testing on the player's setup.

The implementation uses Cfx's [RegisterKeyMapping](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/RegisterKeyMapping.md). Its command, description and default mapper/parameter are registered by the resource; binding edits remain under FiveM's control.

## Français : affecter vos palettes ou boutons

**Depuis la version 0.3.2,** trois actions supplémentaires apparaissent dans **Paramètres → Raccourcis clavier → FiveM**, avec le préfixe **Volant / manette :** lorsque la ressource est en français. Elles sont libres par défaut et restent indépendantes des touches M, Page Up et Page Down.

1. Se connecter au serveur utilisant la version 0.3.2, avec le périphérique branché et reconnu par FiveM.
2. Affecter une palette au rapport supérieur, une autre au rapport inférieur et, si souhaité, un bouton au changement Auto/Séquentielle.
3. Tester à faible vitesse dans un véhicule réseau pris en charge, en mode Séquentielle pour les rapports. Les permissions serveur continuent de s'appliquer.
4. Utiliser ce même menu pour modifier ou retirer les affectations.

Aucune émulation de touche clavier n'est nécessaire pour un bouton reconnu par FiveM. Le choix `JOYSTICK_BUTTON` ne filtre toutefois pas la capture du menu natif : un autre périphérique ou un axe peut encore être capturé. Le blocage de réaffectation déjà signalé n'est pas considéré comme corrigé.

Si une palette était déjà affectée à une ancienne ligne Gearbox, retirer cette ancienne affectation en la déplaçant vers **Volant / manette**. Garder un seul bouton par action et une seule ligne par bouton. Une même action reçue des deux groupes durant la même image du jeu ne déclenche qu'une demande ; les affectations sauvegardées ne sont pas supprimées et les conflits entre actions différentes restent à éviter.

Pour une première affectation d'une action encore libre, les deux exemples F8 ci-dessus sont disponibles. Les boutons 5 et 6 sont arbitraires et doivent correspondre à votre matériel. `rbind` ajoute une affectation : ne pas le répéter pour remplacer une affectation existante ; passer ensuite par les paramètres FiveM.

Le serveur peut proposer des valeurs dans `deviceKeys`, mais les choix déjà sauvegardés par chaque joueur restent prioritaires. Cette fonction ne fournit ni axes bruts, retour de force, boîte en H, embrayage ni sélection d'un périphérique physique précis.
