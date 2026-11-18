"""CAD-BG-02 en un escritorio Windows REAL (CI windows-latest): un trabajo de fondo no debe quitar el foco, abrir ventanas,
mover el cursor ni impedir que el teclado llegue a la aplicación de trabajo.

Ventana de trabajo: Bloc de notas (Word/Excel no están en el agente de CI). Sin AutoCAD: el paso DWG debe terminar
«requiere intervención» y NUNCA abrir una ventana. Esto NO reemplaza la prueba con la persona, Word/Excel y AutoCAD 2027.

Uso:  python tools/gui/prueba_no_interferencia.py <carpeta_salida>
"""
import ctypes
import ctypes.wintypes as wt
import json
import subprocess
import sys
import time
from pathlib import Path

from pywinauto import Application, keyboard

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "dist" / "gui-fondo").resolve()
SALIDA.mkdir(parents=True, exist_ok=True)
u32 = ctypes.windll.user32
k32 = ctypes.windll.kernel32


def visibles():
    out = {}
    cb_t = ctypes.WINFUNCTYPE(ctypes.c_bool, wt.HWND, wt.LPARAM)

    def cb(h, _):
        if u32.IsWindowVisible(h):
            pid = wt.DWORD()
            u32.GetWindowThreadProcessId(h, ctypes.byref(pid))
            n = u32.GetWindowTextLengthW(h)
            b = ctypes.create_unicode_buffer(n + 1)
            u32.GetWindowTextW(h, b, n + 1)
            out[int(h)] = {"pid": pid.value, "titulo": b.value}
        return True
    u32.EnumWindows(cb_t(cb), 0)
    return out


def ejecutable(pid):
    h = k32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not h:
        return None
    try:
        n = wt.DWORD(1024)
        b = ctypes.create_unicode_buffer(1024)
        return Path(b.value).name.lower() if k32.QueryFullProcessImageNameW(h, 0, b, ctypes.byref(n)) else None
    finally:
        k32.CloseHandle(h)


PROPIOS = {"node.exe", "conhost.exe", "powershell.exe", "pwsh.exe", "cmd.exe", "accoreconsole.exe", "acad.exe", "windowsterminal.exe"}


def cursor():
    p = wt.POINT()
    u32.GetCursorPos(ctypes.byref(p))
    return (p.x, p.y)


def latencia_ms(hwnd):
    r = wt.DWORD()
    t0 = time.perf_counter()
    ok = u32.SendMessageTimeoutW(hwnd, 0, 0, 0, 0x0002, 5000, ctypes.byref(r))  # WM_NULL, SMTO_ABORTIFHUNG
    return (time.perf_counter() - t0) * 1000 if ok else 5000.0


notepad = Application(backend="win32").start("notepad.exe")
ventana = notepad.top_window()
ventana.wait("visible", timeout=30)
ventana.set_focus()
time.sleep(1)
fg0 = u32.GetForegroundWindow()
antes = visibles()
cur0 = cursor()
salida_json = SALIDA / "trabajo.json"
proc = subprocess.Popen(["node", str(RAIZ / "scripts" / "gui" / "trabajo-fondo.mjs"), str(salida_json)], cwd=RAIZ,
                        creationflags=0x08000000)  # CREATE_NO_WINDOW: el propio arnés tampoco abre consola
muestras, focos_perdidos, nuevas, latencias, tecleado = 0, [], {}, [], ""
fin = time.time() + 300
while proc.poll() is None and time.time() < fin:
    fg = u32.GetForegroundWindow()
    if fg != fg0:
        focos_perdidos.append({"t": round(time.time(), 2), "hwnd": int(fg), "titulo": visibles().get(int(fg), {}).get("titulo")})
    for h, info in visibles().items():
        if h not in antes and info["pid"] != notepad.process:
            info["ejecutable"] = ejecutable(info["pid"])
            nuevas[h] = info
    latencias.append(latencia_ms(ventana.handle))
    if muestras % 10 == 0:
        frag = f"tannia{muestras // 10} "
        keyboard.send_keys(frag, with_spaces=True, pause=0.01)  # la persona sigue escribiendo
        tecleado += frag
    muestras += 1
    time.sleep(0.1)
time.sleep(1)
texto = ventana.child_window(class_name="Edit").window_text() if ventana.child_window(class_name="Edit").exists() else ventana.window_text()
trabajo = json.loads(salida_json.read_text(encoding="utf-8")) if salida_json.exists() else None
try:
    import PIL.ImageGrab as G
    G.grab().save(SALIDA / "escritorio-final.png")
except Exception:  # captura informativa
    pass
informe = {
    "prueba": "CAD-BG-02 no interferencia (Bloc de notas como ventana de trabajo, CI windows-latest)",
    "muestras": muestras, "foco_perdido": focos_perdidos, "ventanas_nuevas": list(nuevas.values()),
    "ventanas_nuevas_de_procesos_de_tannia": [v for v in nuevas.values() if v.get("ejecutable") in PROPIOS],
    "cursor_inicial": cur0, "cursor_final": cursor(), "latencia_max_ms": round(max(latencias or [0]), 1),
    "latencia_media_ms": round(sum(latencias) / max(1, len(latencias)), 1), "tecleado": tecleado,
    "tecleado_llego_al_bloc": tecleado.strip() != "" and tecleado.strip() in texto.strip().replace("\r\n", " "), "trabajo": trabajo,
}
(SALIDA / "no_interferencia.json").write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
notepad.kill()
fallos = []
if trabajo is None:
    fallos.append("el trabajo no terminó")
elif trabajo["estado"] != "REQUIERE_INTERVENCIÓN" or [p["estado"] for p in trabajo["pasos"]] != ["hecho", "hecho", "hecho", "hecho", "requiere_intervencion"]:
    fallos.append(f"estado inesperado: {trabajo['estado']}")
elif trabajo.get("recursos", {}).get("prioridad") != trabajo["prioridad_esperada"]:
    fallos.append(f"prioridad del proceso de fondo: {trabajo.get('recursos')}")
if focos_perdidos:
    fallos.append(f"la ventana de trabajo perdió el foco {len(focos_perdidos)} vez/veces")
if informe["ventanas_nuevas_de_procesos_de_tannia"]:
    fallos.append(f"aparecieron ventanas de procesos de Tannia: {informe['ventanas_nuevas_de_procesos_de_tannia']}")
if cursor() != cur0:
    fallos.append("el cursor se movió")
if not informe["tecleado_llego_al_bloc"]:
    fallos.append("lo escrito no llegó al Bloc de notas")
if informe["latencia_max_ms"] > 1000:
    fallos.append(f"el Bloc de notas dejó de responder ({informe['latencia_max_ms']} ms)")
print(json.dumps(informe, ensure_ascii=False, indent=2)[:4000])
if fallos:
    print("FALLA:", "; ".join(fallos))
    sys.exit(1)
print("OK: sin cambio de foco, sin ventanas nuevas, cursor intacto, teclado y respuesta del Bloc de notas normales.")
