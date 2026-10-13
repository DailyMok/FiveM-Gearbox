fx_version 'cerulean'
game 'gta5'
author 'Standalone Gearbox'
description 'Independent adaptive gearbox: native RPM/audio, automatic and sequential'
version '0.3.0'

-- FiveM resource manifest syntax only; all executable gearbox logic is JavaScript.
shared_scripts {
    'internal/physics.js', 'shared/settings.js',
    'config.js', 'vehicle-profiles.js', 'shared/bootstrap.js'
}
server_scripts { 'server/permissions.js', 'server/access.js', 'server/main.js' }
client_scripts {
    'locales/en.js', 'locales/fr.js', 'shared/locale.js',
    'internal/model-profiles.js',
    'shared/logic.js',
    'client/driven-lock.js', 'client/wheel-brake.js',
    'client/cap-rpm.js',
    'client/controller.js',
    'client/hud.js', 'client/access.js', 'client/public-api.js',
    'client/main.js'
}

ui_page 'web/index.html'
files { 'web/index.html', 'web/style.css', 'web/app.js', 'web/gear-sound.js' }
-- Optional licensed shift sounds: add both WAV paths to files above before enabling.
dependencies { '/onesync' }
