import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data: any) => {
      let validChannels = ['pty:write', 'pty:resize', 'pty:kill', 'security:git-push-response', 'telemetry:open'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel: string, data: any) => {
      let validChannels = [
        'pty:create', 
        'devtime:start-session', 
        'devtime:end-session', 
        'devtime:get-status', 
        'devtime:get-report',
        'files:list',
        'files:read',
        'chat:send'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
      return Promise.reject(new Error(`Invalid channel ${channel}`));
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      let validChannels = ['pty:data', 'security:alert', 'telemetry:update', 'chat:stream', 'chat:error'];
      if (validChannels.includes(channel)) {
        const subscription = (_event: any, ...args: any[]) => func(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
      return () => {};
    }
  }
});
