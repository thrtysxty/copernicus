// Log file locations:
// macOS: ~/Library/Logs/COPERNICUS/main.log
// Windows: %USERPROFILE%\AppData\Roaming\COPERNICUS\logs\main.log
// Linux: ~/.config/COPERNICUS/logs/main.log

import log from 'electron-log/main'

log.transports.file.level = 'info'
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'

export default log
