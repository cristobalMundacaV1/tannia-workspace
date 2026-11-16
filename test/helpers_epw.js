// EPW sintético determinista para pruebas (no es clima real).
export function epwSintetico({ lat = -33.45, lon = -70.67, tz = -4, vientoInvierno = 200, vientoVerano = 230, comentario = 'Datos sintéticos de prueba', faltantes = 0, horas = 8760 } = {}) {
  const L = [`LOCATION,Santiago Sintetico,RM,CHL,SINTETICO,855740,${lat},${lon},${tz},520.0`, 'DESIGN CONDITIONS,0', 'TYPICAL/EXTREME PERIODS,0', 'GROUND TEMPERATURES,0', 'HOLIDAYS/DAYLIGHT SAVING,No,0,0,0', `COMMENTS 1,${comentario}`, 'COMMENTS 2,sin comentarios', 'DATA PERIODS,1,1,Data,Sunday, 1/ 1,12/31'];
  const dm = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let n = 0;
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= dm[m - 1]; d++) for (let h = 1; h <= 24; h++) {
    if (n++ >= horas) break;
    const dia = (m - 1) * 30 + d; const T = 14 + 9 * Math.cos(((dia - 15) / 365) * 2 * Math.PI) + 5 * Math.sin(((h - 9) / 24) * 2 * Math.PI) * (lat < 0 ? 1 : 1); // verano austral ~ dic-ene
    const inv = m >= 6 && m <= 8; const wdir = inv ? vientoInvierno : vientoVerano; const wspd = 2 + (h % 7) * 0.3; const ghi = h >= 8 && h <= 19 ? Math.max(0, 800 * Math.sin(((h - 7.5) / 12) * Math.PI)) : 0;
    const miss = faltantes && n % faltantes === 0;
    const c = new Array(35).fill('0'); c[0] = 2020; c[1] = m; c[2] = d; c[3] = h; c[4] = 60; c[5] = '?0'; c[6] = miss ? 99.9 : T.toFixed(1); c[7] = 8; c[8] = 55; c[9] = 95000; c[13] = ghi.toFixed(0); c[14] = (ghi * 0.7).toFixed(0); c[15] = (ghi * 0.3).toFixed(0); c[20] = wdir; c[21] = wspd.toFixed(1);
    L.push(c.join(','));
  }
  return L.join('\n');
}
