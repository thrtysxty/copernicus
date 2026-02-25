import { TouchBar, ipcMain, BrowserWindow } from 'electron';

const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

export function createTouchBar(window: BrowserWindow) {
  // 1. Storyboard Segment
  const blueprintBtn = new TouchBarButton({
    label: 'BLUEPRINT',
    backgroundColor: '#050505',
    click: () => window.webContents.send('layout:set-view', 'blueprint')
  });

  const engineBtn = new TouchBarButton({
    label: 'ENGINE',
    backgroundColor: '#050505',
    click: () => window.webContents.send('layout:set-view', 'engine-room')
  });

  const studioBtn = new TouchBarButton({
    label: 'STUDIO',
    backgroundColor: '#050505',
    click: () => window.webContents.send('layout:set-view', 'studio')
  });

  // 2. Command Tray
  const buildBtn = new TouchBarButton({
    label: '🔨 BUILD',
    backgroundColor: '#3F3F46', // Steel
    click: () => ipcMain.emit('system:make', null, 'build')
  });

  const testBtn = new TouchBarButton({
    label: '🧪 TEST',
    backgroundColor: '#3F3F46',
    click: () => ipcMain.emit('system:make', null, 'test')
  });

  // 3. Telemetry Monitor
  const storyLabel = new TouchBarLabel({
    label: 'STORY: NONE',
    textColor: '#4ADE80' // Phosphor
  });

  const timerLabel = new TouchBarLabel({
    label: '00:00:00',
    textColor: '#4ADE80'
  });

  // 4. Instrument Toggles
  const flipBtn = new TouchBarButton({
    label: '🔄 FLIP',
    click: () => window.webContents.send('layout:toggle-flip', 'focused')
  });

  const spotBtn = new TouchBarButton({
    label: '🔦 SPOT',
    click: () => window.webContents.send('layout:toggle-spotlight')
  });

  const touchBar = new TouchBar({
    items: [
      blueprintBtn,
      engineBtn,
      studioBtn,
      new TouchBarSpacer({ size: 'small' }),
      buildBtn,
      testBtn,
      new TouchBarSpacer({ size: 'large' }),
      storyLabel,
      new TouchBarSpacer({ size: 'small' }),
      timerLabel,
      new TouchBarSpacer({ size: 'large' }),
      flipBtn,
      spotBtn
    ]
  });

  window.setTouchBar(touchBar);

  // Listen for telemetry updates from Renderer to update TouchBar labels
  ipcMain.on('telemetry:update-touchbar', (_, data: { storyId: string, timer?: string }) => {
    if (data.storyId) storyLabel.label = `STORY: ${data.storyId}`;
    if (data.timer) timerLabel.label = data.timer;
  });

  return touchBar;
}
