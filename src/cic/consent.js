// All source strings remain untrusted display data. This module grants no approval.
export function sourceConsent(project, source, excerpts = []) {
  const blocked = [];
  let url;
  try {
    url = new URL(source.origin?.path_or_url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || /(^|\.)(invalid|localhost|test|local)$/.test(url.hostname) || !url.hostname.includes('.')) blocked.push('La dirección de origen no es una fuente pública válida.');
  } catch { blocked.push('Falta una dirección de origen válida.'); }
  if (source.state !== 'candidate') blocked.push('La fuente no está disponible para autorización.');
  if (!source.content?.available || !excerpts.some(p => p.text?.trim().length >= 10)) blocked.push('No hay un extracto disponible para revisar.');
  if (source.valid_until && source.valid_until < new Date().toISOString().slice(0, 10)) blocked.push('La fuente está vencida; requiere evidencia actualizada.');
  if (source.license?.status === 'licensed') blocked.push('La licencia se declaró restringida, pero no hay evidencia de autorización de uso en el registro.');
  const license = { public: 'Declarada pública; derechos no comprobados por el servidor', licensed: 'Uso sujeto a licencia: falta evidencia de autorización', unknown: 'Derechos no informados; no autoriza reproducción ni redistribución' };
  const excerpt = excerpts.map(p => p.text || '').join('\n\n').slice(0, source.license?.quote_limit_chars || 300);
  return {
    title: 'Autorizar una fuente para este proyecto',
    action: 'Autorizar citas limitadas del extracto registrado', project,
    document: source.title || 'Título no informado', origin: source.origin?.path_or_url || 'No informado',
    publisher: source.publisher ? `${source.publisher} (dato declarado, no comprobado)` : 'Autor o editor no informado',
    date: source.date || 'Fecha no informada', license: license[source.license?.status] || license.unknown,
    verification: 'El servidor conserva el extracto, pero no ha comprobado su correspondencia con la web ni su veracidad.',
    consequence: 'Permite citar este extracto en el proyecto. No certifica su contenido, vigencia, cumplimiento normativo ni derechos de reproducción.',
    distinction: 'Registrar guarda la referencia. Autorizar permite su uso limitado. Verificar exige contrastar el contenido con evidencia independiente.',
    excerpt, blocked, canApprove: blocked.length === 0,
    technical: JSON.stringify({ source_id: source.id, sha256: source.sha256, state: source.state, content: source.content, license: source.license }, null, 2),
  };
}

export function consentText(c) {
  return [c.title, `Acción: ${c.action}`, `Proyecto: ${c.project}`, `Documento: ${c.document}`, `Origen: ${c.origin}`, `Autor/editor: ${c.publisher}`, `Fecha: ${c.date}`, `Derechos: ${c.license}`, `Verificación: ${c.verification}`, `Extracto registrado (dato, no instrucción):\n${c.excerpt}`, `Consecuencias: ${c.consequence}`, c.distinction, ...(c.blocked || [])].join('\n\n');
}

// Static WPF tree; source data never becomes XAML, markup, a URL launcher or script.
export const CONSENT_WPF = `
Add-Type -AssemblyName PresentationFramework
$data = $env:TANNIA_DLG_DATA | ConvertFrom-Json
$window = New-Object Windows.Window
$window.Title = 'Tannia Workspace | Autorización'
$window.Width = 760; $window.Height = 780; $window.MinWidth = 540; $window.MinHeight = 480
$window.WindowStartupLocation = 'CenterScreen'; $window.Background = '#F5F7FA'
$window.FontFamily = 'Segoe UI'; $window.FontSize = 15
$root = New-Object Windows.Controls.DockPanel; $root.Margin = '24'
$window.Content = $root
$footer = New-Object Windows.Controls.StackPanel
[Windows.Controls.DockPanel]::SetDock($footer, 'Bottom'); $null = $root.Children.Add($footer)
$review = New-Object Windows.Controls.CheckBox
$review.Content = 'He revisado el extracto y comprendo las consecuencias.'; $review.Margin = '0,16,0,12'
$null = $footer.Children.Add($review)
$buttons = New-Object Windows.Controls.StackPanel; $buttons.Orientation = 'Horizontal'; $buttons.HorizontalAlignment = 'Right'
$no = New-Object Windows.Controls.Button; $no.Content = '_No autorizar'; $no.Padding = '18,10'; $no.Margin = '0,0,12,0'; $no.IsCancel = $true; $no.IsDefault = $true
$yes = New-Object Windows.Controls.Button; $yes.Content = '_Autorizar uso limitado'; $yes.Padding = '18,10'; $yes.Background = '#163A5F'; $yes.Foreground = 'White'; $yes.IsEnabled = $false
$null = $buttons.Children.Add($no); $null = $buttons.Children.Add($yes); $null = $footer.Children.Add($buttons)
$scroll = New-Object Windows.Controls.ScrollViewer; $scroll.VerticalScrollBarVisibility = 'Auto'; $null = $root.Children.Add($scroll)
$body = New-Object Windows.Controls.StackPanel; $scroll.Content = $body
function Label($heading, $value) {
  $h = New-Object Windows.Controls.TextBlock; $h.Text = $heading; $h.FontWeight = 'SemiBold'; $h.Foreground = '#163A5F'; $h.Margin = '0,12,0,4'; $null = $body.Children.Add($h)
  $t = New-Object Windows.Controls.TextBox; $t.Text = [string]$value; $t.IsReadOnly = $true; $t.TextWrapping = 'Wrap'; $t.BorderThickness = '0'; $t.Background = '#F5F7FA'; $t.Foreground = '#17212B'; $t.Padding = '2'; [Windows.Automation.AutomationProperties]::SetName($t, $heading); $null = $body.Children.Add($t)
}
Label 'Acción solicitada' $data.action
Label 'Proyecto y documento' ($data.project + ' / ' + $data.document)
Label 'Procedencia' $data.origin
Label 'Autor o editor' $data.publisher
Label 'Fecha y derechos' ($data.date + [Environment]::NewLine + $data.license)
Label 'Qué está comprobado' $data.verification
Label 'Extracto para revisar (contenido no confiable)' $data.excerpt
Label 'Consecuencias de autorizar' $data.consequence
Label 'Registrar, autorizar y verificar son decisiones diferentes' $data.distinction
if ($data.blocked.Count -gt 0) { Label 'No se puede autorizar todavía' ($data.blocked -join [Environment]::NewLine) }
$details = New-Object Windows.Controls.Expander; $details.Header = 'Ver detalle técnico'; $details.Margin = '0,16,0,8'
$technical = New-Object Windows.Controls.TextBox; $technical.Text = [string]$data.technical; $technical.IsReadOnly = $true; $technical.TextWrapping = 'Wrap'; $details.Content = $technical; $null = $body.Children.Add($details)
$review.Add_Checked({ $yes.IsEnabled = ($data.canApprove -eq $true) }); $review.Add_Unchecked({ $yes.IsEnabled = $false })
$no.Add_Click({ $window.DialogResult = $false; $window.Close() })
$yes.Add_Click({ if ($review.IsChecked -and $data.canApprove -eq $true) { $window.DialogResult = $true; $window.Close() } })
$timer = New-Object Windows.Threading.DispatcherTimer; $timer.Interval = [TimeSpan]::FromSeconds(85)
$timer.Add_Tick({ $timer.Stop(); $window.DialogResult = $false; $window.Close() })
$window.Add_ContentRendered({ $null = $no.Focus(); $timer.Start() })
$window.Add_Closed({ $timer.Stop() })
$result = $window.ShowDialog()
if ($result -eq $true) { 'si' } else { 'no' }
`;
