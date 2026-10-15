(function (root) {
  'use strict';
  const actions = [
    { name: 'up', key: 'upKey', label: 'keyUp', deviceLabel: 'keyDeviceUp' },
    { name: 'down', key: 'downKey', label: 'keyDown', deviceLabel: 'keyDeviceDown' },
    { name: 'toggle', key: 'toggleKey', label: 'keyToggle', deviceLabel: 'keyDeviceToggle' }
  ];
  const padButtons = new Set([
    'L1_INDEX', 'R1_INDEX', 'L2_INDEX', 'R2_INDEX', 'L3_INDEX', 'R3_INDEX',
    'LUP_INDEX', 'LRIGHT_INDEX', 'LDOWN_INDEX', 'LLEFT_INDEX',
    'RUP_INDEX', 'RRIGHT_INDEX', 'RDOWN_INDEX', 'RLEFT_INDEX',
    'SELECT_INDEX', 'START_INDEX', 'TOUCH_INDEX'
  ]);
  const token = value => typeof value === 'string' ? value.trim().toUpperCase() : null;
  function valid(mapper, parameter) {
    if (mapper !== 'JOYSTICK_BUTTON' && mapper !== 'PAD_DIGITALBUTTON') return false;
    if (parameter === '') return true;
    if (mapper === 'JOYSTICK_BUTTON') return /^IOM_JOYSTICK_BUTTON(?:[1-9]|[12][0-9]|3[0-2])$/.test(parameter || '');
    return padButtons.has(parameter);
  }
  function register(config, translate, handlers) {
    const device = config.deviceKeys || {};
    const mapper = token(device.mapper === undefined ? 'JOYSTICK_BUTTON' : device.mapper);
    const warn = (key, action) => root.console.error('[standalone_gearbox] ' + translate(key, { action }));
    const bindings = actions.map(action => {
      const parameter = token(device[action.name] === undefined ? '' : device[action.name]);
      if (valid(mapper, parameter)) return { action, mapper, parameter };
      warn('invalidDeviceBinding', action.name);
      return { action, mapper: 'JOYSTICK_BUTTON', parameter: '' };
    });
    // Conflicting defaults must not make one button shift both ways or also toggle mode.
    const counts = new Map();
    for (const binding of bindings) {
      if (binding.parameter) counts.set(binding.parameter, (counts.get(binding.parameter) || 0) + 1);
    }
    for (const binding of bindings) {
      if (binding.parameter && counts.get(binding.parameter) > 1) {
        warn('duplicateDeviceBinding', binding.action.name);
        binding.parameter = '';
      }
    }
    // A paddle may still be bound to an old keyboard action after an update.
    // Ignore its duplicate action from the other mapping in the same frame,
    // without delaying intentional repeated presses through the same mapping.
    const lastPress = new Map();
    const dispatch = (action, source) => () => {
      const frame = root.GetFrameCount();
      const previous = lastPress.get(action);
      if (previous && previous.frame === frame && previous.source !== source) return;
      lastPress.set(action, { frame, source });
      handlers[action]();
    };
    const bind = (command, label, defaultMapper, parameter, handler) => {
      root.RegisterCommand('+' + command, () => handler(), false);
      root.RegisterCommand('-' + command, () => {}, false);
      root.RegisterKeyMapping('+' + command, translate(label), defaultMapper, parameter);
    };
    // Existing command identifiers stay stable so saved keyboard bindings survive updates.
    for (const action of actions) {
      bind('sgbox_' + action.name, action.label, 'keyboard', config[action.key], dispatch(action.name, 'keyboard'));
    }
    // A distinct unassigned command creates its own native settings row. Empty '~!' mappings do not.
    // FiveM owns capture and persistence; never rewrite a player's profile or issue broad unbinds.
    for (const { action, mapper: defaultMapper, parameter } of bindings) {
      bind('sgbox_device_' + action.name, action.deviceLabel, defaultMapper, parameter, dispatch(action.name, 'device'));
    }
  }
  root.StandaloneGearboxInputs = { register };
})(globalThis);
