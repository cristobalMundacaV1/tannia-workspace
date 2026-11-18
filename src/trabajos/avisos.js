// Aviso «los planos están listos» sin interrumpir: notificación del Centro de actividades de Windows (no toma el foco ni el teclado).
// Se lanza con PowerShell OCULTO y sin perfil; si falla no pasa nada (el estado sigue disponible en Tannia).
// ESTADO: NO VERIFICADO en Windows real con la persona (CAD-BG-02). Desactivable con TANNIA_AVISOS=off.
import { spawn } from 'node:child_process';

const xmlSeguro = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]).slice(0, 240);

export function guionAviso({ titulo, texto }) {
  // AppUserModelID de Windows PowerShell: permite mostrar la notificación sin registrar una aplicación nueva.
  const xml = `<toast><visual><binding template="ToastGeneric"><text>${xmlSeguro(titulo)}</text><text>${xmlSeguro(texto)}</text></binding></visual></toast>`;
  return `$ErrorActionPreference='Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$x = New-Object Windows.Data.Xml.Dom.XmlDocument; $x.LoadXml('${xml.replace(/'/g, "''")}')
$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($x))`;
}

export function avisarEscritorio({ titulo, texto }, { platform = process.platform, env = process.env, lanzar = spawn } = {}) {
  if (env.TANNIA_AVISOS === 'off' || env.CI) return { estado: 'desactivado' };
  if (platform !== 'win32') return { estado: 'no_aplica', motivo: 'Avisos de escritorio solo en Windows.' };
  try {
    const cmd = Buffer.from(guionAviso({ titulo, texto }), 'utf16le').toString('base64');
    const c = lanzar('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', cmd], { windowsHide: true, stdio: 'ignore', detached: true });
    c.on?.('error', () => {}); c.unref?.();
    return { estado: 'enviado', verificado_en_windows_real: false };
  } catch (e) { return { estado: 'no_enviado', motivo: String(e.message).slice(0, 120) }; }
}
