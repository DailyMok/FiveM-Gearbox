# Manual Neutral and Reverse in Sequential mode

## English

**Version 0.3.2** adds manual Neutral (`N`) and Reverse (`R`) selection in Sequential mode.

### Controls and selection

Use the existing shift keys (keyboard or wheel/controller), commands or `shift(1/-1)` export. The keyboard defaults remain Page Up and Page Down.

| Starting selection | Input | Next selection |
|---|---|---|
| First gear | Shift down | Neutral (`N`) |
| Neutral | Shift down | Reverse (`R`) |
| Reverse | Shift up | Neutral (`N`) |
| Neutral | Shift up | First gear (`1`) |

The manual sequence is `1 -> N -> R` downward and `R -> N -> 1` upward. There is **no vehicle-speed threshold for requesting manual N or R**. This describes selection in the controller, not proof that GTA immediately applies the requested wheel force.

After explicitly selecting N, it stays selected until another manual shift or a switch to Auto. Accelerator or brake input alone does not cancel it. Explicit R can be left manually through N, or it returns to first gear when the vehicle is at standstill and the accelerator is pressed. Switching to Auto clears the manual selection and restores the existing automatic behavior.

Before any manual N/R selection, the original behavior remains: reverse is selected automatically at standstill with native reverse input, and forward input returns to first gear. W and S are not swapped. Keep using GTA's native brake/reverse control, normally S, to drive backward; use the normal accelerator to drive forward.

### How Neutral and Reverse operate

Neutral applies a native engine-torque multiplier of zero each frame while preserving the driver's brake input. It does not apply an external stopping force, set the vehicle speed or change handling data to imitate neutral.

The [Cfx torque native documentation](https://github.com/citizenfx/natives/blob/master/VEHICLE/SetVehicleCheatPowerIncrease.md) describes a per-frame multiplier; zero as a neutral actuator still needs physical validation. [Cfx's gear-ratio example](https://github.com/citizenfx/fivem/blob/master/ext/native-decls/SetVehicleGearRatio.md) identifies native slot zero as reverse, not neutral.

Manual Reverse requests native current gear and next gear `0`, while retaining the vehicle's original reverse ratio. It does not inject reverse force, alter speed or use a replacement handling model. GTA may still brake the vehicle before applying reverse traction even when the native gear readback is `0`. A displayed R or a native gear value is therefore not evidence of reverse traction while moving or sliding.

The HUD/API report N and R as logical selections. `active` remains false in these ranges because that flag describes the custom **forward** transmission. A custom HUD should stay visible while `gear` is not null and display `displayGear`; see [HUD-API.md](HUD-API.md).

### In-game test procedure

See [VALIDATION.md](VALIDATION.md) for automated-check status. Simulated native calls cannot validate clutch behavior, tire forces or a sliding reversal. Complete and record these tests on your server:

1. Start the resource on a OneSync server. Use a supported networked vehicle and an authorized driver. Confirm Auto/Sequential switching first.
2. In Sequential, use the shift keys and `/sgbox up` / `/sgbox down` to follow `1 -> N -> R -> N -> 1`. Check the included HUD and a custom HUD with N/R support. Confirm the forward ratios above first gear still shift normally.
3. Select N at standstill and while rolling forward. Apply the accelerator, then the brake separately. Record whether engine traction is absent, the brake remains effective and N stays selected. Coast speed alone does not prove neutral because drag and slope also affect it.
4. Select R at standstill, then use the native brake/reverse control to move backward. Test shift-up to N and then first gear. Separately, stop while R remains selected and press the accelerator; confirm the return to first gear.
5. While moving forward and again during a controlled slide, request N then R without waiting for a speed threshold. Record the selected range, native current/next gear, driver input, actual motion and observed wheel behavior. Distinguish immediate range selection from braking followed by reverse traction. Compare with the same vehicle's native behavior under comparable initial conditions.
6. Enter Sequential again without selecting N/R manually. Check the original automatic reverse-at-standstill and forward-input return. Switch to Auto from N and R and verify that no manual selection persists.
7. Check vehicle exit, driver handover, resource stop/start and loss/regain of network control. Confirm there is no lingering zero-torque effect or stale N/R display after control ends.

Record the GTA/FiveM build, vehicle/model overrides, surface, inputs and observed result. A startup without errors or a gear readback cannot replace the driving tests.

## Français

**La version 0.3.2** ajoute la sélection manuelle du point mort (`N`) et de la marche arrière (`R`) en mode Séquentielle.

### Commandes et comportement

Les touches existantes (clavier ou volant/manette) suffisent : Page Down suit `1 -> N -> R`, Page Up suit `R -> N -> 1`. Les commandes `/sgbox down`, `/sgbox up` et l'export `shift` suivent la même logique. Aucun seuil de vitesse ne bloque la **demande de sélection manuelle** de N ou R ; cela ne prouve pas que GTA applique immédiatement une traction en marche arrière.

Un N choisi manuellement reste sélectionné jusqu'à un autre changement manuel ou au retour en Auto. Freiner ou accélérer ne l'annule pas. Un R choisi manuellement se quitte en remontant vers N puis 1, ou revient à la première lorsque le véhicule est à l'arrêt et que l'accélérateur est pressé. Repasser en Auto efface la sélection manuelle.

Sans sélection manuelle de N/R, le comportement précédent est conservé : marche arrière automatique à l'arrêt avec la commande native correspondante, puis première avec l'accélérateur. W et S ne sont pas inversées : la commande native de frein/marche arrière, normalement S, sert toujours à reculer.

### Limites et essais

Le N demande l'annulation du couple moteur avec une native appliquée à chaque frame et conserve la commande de frein. Le R impose les rapports natifs courant/suivant à `0` en gardant le rapport de marche arrière d'origine. Aucun ajout de force, changement de vitesse imposée ou modification du handling ne simule le résultat.

**Le comportement physique reste à vérifier en jeu.** GTA peut continuer à freiner avant d'appliquer la traction arrière, même si le rapport natif vaut `0`. Ni le R affiché ni cette valeur ne prouvent une prise de marche arrière pendant une glisse. L'état des tests automatiques de cette variante est consigné dans la [fiche de validation](VALIDATION.md).

Sur un véhicule réseau pris en charge, vérifier successivement :

1. La séquence `1 -> N -> R -> N -> 1`, avec les touches puis les commandes, et l'affichage N/R sur les HUD.
2. Le maintien du N à l'arrêt et en roulant, sans traction moteur sous accélérateur, avec un frein toujours fonctionnel.
3. Le départ en marche arrière avec la commande native, la remontée manuelle via N et le retour en première à l'arrêt sous accélérateur.
4. La sélection de N puis R en avançant et pendant une glisse contrôlée. Noter les entrées, rapports natifs, déplacement réel et comportement des roues ; distinguer la sélection immédiate d'un freinage suivi d'une traction arrière.
5. La marche arrière automatique précédente tant que N/R n'ont pas été choisis manuellement, puis le retour en Auto depuis N et R.
6. La sortie du véhicule, le changement de conducteur, l'arrêt/redémarrage de la ressource et la perte/reprise de contrôle réseau : aucune coupure de couple ni indication N/R ne doit persister après la fin du contrôle.

Conserver les résultats avec la version FiveM/GTA et le modèle testé. Dans l'API, `active: false` en N/R décrit l'absence de transmission avant personnalisée ; le HUD doit continuer à afficher `gear` / `displayGear` tant que `gear` n'est pas nul. Le problème du menu natif de réaffectation reste distinct et n'est pas corrigé ici.
