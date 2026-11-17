"""Prueba REAL de la ventana WPF de autorización de Tannia Workspace con Windows UI Automation (pywinauto, backend UIA).

Ejecuta el servidor MCP real (scripts/gui/escenario-ventana.mjs) en un proyecto temporal; la herramienta abre la ventana WPF
real; este driver la inspecciona, captura y acciona. Requiere Windows con escritorio interactivo.

Uso:  python tools/gui/prueba_ventana_wpf.py <carpeta_salida>
Las confirmaciones hechas aquí son SIMULADAS por UI Automation: NO son aceptación humana.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from pywinauto import Desktop, keyboard

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "dist" / "gui").resolve()
SALIDA.mkdir(parents=True, exist_ok=True)
TITULO = r"Tannia Workspace .*Autorizaci.n"
resultados = []


def lanzar(escenario, *extra):
    json_out = SALIDA / f"{escenario}.json"
    for f in (json_out, Path(f"{json_out}.listo")):
        if f.exists():
            f.unlink()
    proc = subprocess.Popen(["node", str(RAIZ / "scripts" / "gui" / "escenario-ventana.mjs"), escenario, str(json_out), *extra], cwd=RAIZ)
    return proc, json_out


def ventana(timeout=90):
    fin = time.time() + timeout
    while time.time() < fin:
        ws = [w for w in Desktop(backend="uia").windows(title_re=TITULO, visible_only=True)]
        if ws:
            w = ws[0]
            w.set_focus()
            time.sleep(0.8)
            return w
        time.sleep(0.5)
    raise RuntimeError("la ventana WPF no apareció")


def textos(w):
    out = []
    for c in w.descendants():
        try:
            ct = c.element_info.control_type
            if ct == "Edit":
                out.append(c.get_value() if hasattr(c, "get_value") else c.window_text())
            elif ct in ("Text", "Button", "CheckBox"):
                out.append(c.window_text())
        except Exception:
            pass
    return "\n".join(t for t in out if t)


def control(w, auto_id):
    return w.child_window(auto_id=auto_id).wrapper_object()


def dentro(w, c):
    r, v = c.rectangle(), w.rectangle()
    return r.left >= v.left and r.right <= v.right and r.top >= v.top and r.bottom <= v.bottom and r.width() > 0 and r.height() > 0


def captura(w, nombre):
    f = SALIDA / f"{nombre}.png"
    w.capture_as_image().save(f)
    return f.name


def terminar(proc, json_out, timeout=120):
    proc.wait(timeout=timeout)
    return json.loads(json_out.read_text(encoding="utf-8"))


def caso(nombre, fn):
    t0 = time.time()
    try:
        det = fn()
        resultados.append({"caso": nombre, "ok": True, "s": round(time.time() - t0, 1), **(det or {})})
        print(f"OK    {nombre}")
    except Exception as e:  # noqa: BLE001
        resultados.append({"caso": nombre, "ok": False, "error": str(e)[:800]})
        print(f"FALLA {nombre}: {e}")


def esperar_sin_ventana(timeout=20):
    fin = time.time() + timeout
    while time.time() < fin:
        if not Desktop(backend="uia").windows(title_re=TITULO, visible_only=True):
            return True
        time.sleep(0.3)
    return False


def no_verificada(r, codigo):
    assert r["resultados"][0].get("resultado_codigo") == codigo, r
    assert r["verificada_persistida"] is False, r
    assert r["recibos_verificacion"] == 0, r


ESPERADO_TEXTO = ["Cantidad que va a confirmar: 10 m²", "5 m × 2,4 m = 12 m²", "Descuento por puerta: 1 m × 2 m = 2 m²", "Superficie neta: 12 − 2 = 10 m²", "no medidas en el plano", "No se comprobó en el plano si existen otros vanos", "sin trazabilidad geométrica", "La aprobación de la entrega es un paso posterior"]


def c_contenido_y_confirmar(escala="1"):
    def f():
        proc, js = lanzar(f"confirmar_{escala}", "--escala", escala)
        w = ventana()
        txt = textos(w)
        faltan = [e for e in ESPERADO_TEXTO if e not in txt]
        assert not faltan, f"texto faltante: {faltan}"
        si, no, chk = control(w, "btnAutorizar"), control(w, "btnNoAutorizar"), control(w, "chkRevisado")
        assert "Confirmar 10 m²" in si.window_text() and "No confirmar" in no.window_text(), (si.window_text(), no.window_text())
        for c in (si, no, chk):
            assert c.is_visible() and dentro(w, c), f"control fuera de la ventana: {c.window_text()}"
        assert not si.is_enabled(), "Autorizar debe estar deshabilitado hasta marcar la casilla"
        img = captura(w, f"ventana_escala_{escala.replace('.', '_')}")
        chk.click_input()
        time.sleep(0.3)
        assert si.is_enabled()
        si.click_input()
        r = terminar(proc, js)
        assert r["resultados"][0].get("ok") and r["verificada_persistida"] is True and r["recibos_verificacion"] == 1, r
        return {"captura": img, "resultado": r["resultados"][0], "autorizacion": "SIMULADA"}
    return f


def c_rechazo():
    proc, js = lanzar("rechazo")
    w = ventana()
    control(w, "btnNoAutorizar").click_input()
    r = terminar(proc, js)
    no_verificada(r, "RECHAZADO_POR_LA_PERSONA")
    return {"resultado": r["resultados"][0]}


def c_tecla(nombre, teclas, codigo):
    def f():
        proc, js = lanzar(nombre)
        w = ventana()
        keyboard.send_keys(teclas)
        r = terminar(proc, js)
        no_verificada(r, codigo)
        assert esperar_sin_ventana()
        return {"teclas": teclas, "resultado": r["resultados"][0]}
    return f


def c_teclado_confirma():
    proc, js = lanzar("teclado")
    w = ventana()
    orden = []
    for _ in range(6):
        keyboard.send_keys("{TAB}")
        time.sleep(0.2)
        foco = [c for c in w.descendants() if c.has_keyboard_focus()]
        orden.append(foco[0].element_info.automation_id or foco[0].window_text()[:30] if foco else None)
    assert "chkRevisado" in orden and "btnNoAutorizar" in orden, f"orden de tabulación: {orden}"
    chk = control(w, "chkRevisado")
    chk.set_focus()
    keyboard.send_keys("{SPACE}")
    time.sleep(0.2)
    control(w, "btnAutorizar").set_focus()
    keyboard.send_keys("{ENTER}")
    r = terminar(proc, js)
    assert r["resultados"][0].get("ok") and r["recibos_verificacion"] == 1, r
    return {"orden_tab": orden, "autorizacion": "SIMULADA"}


def c_enter_sobre_no():
    proc, js = lanzar("enter_no")
    w = ventana()
    control(w, "btnNoAutorizar").set_focus()
    keyboard.send_keys("{ENTER}")
    r = terminar(proc, js)
    no_verificada(r, "RECHAZADO_POR_LA_PERSONA")
    return {"resultado": r["resultados"][0]}


def c_timeout():
    proc, js = lanzar("timeout", "--timeout", "5")
    ventana()
    r = terminar(proc, js, timeout=60)
    no_verificada(r, "TIEMPO_AGOTADO")
    return {"resultado": r["resultados"][0]}


def c_error_tecnico():
    proc, js = lanzar("error_tecnico")
    w = ventana()
    pid = w.process_id()
    subprocess.run(["taskkill", "/PID", str(pid), "/F"], check=False, capture_output=True)
    r = terminar(proc, js)
    no_verificada(r, "ERROR_TECNICO_VENTANA")
    return {"proceso_terminado": pid, "resultado": r["resultados"][0]}


def c_doble_clic():
    proc, js = lanzar("doble_clic")
    w = ventana()
    control(w, "chkRevisado").click_input()
    time.sleep(0.3)
    control(w, "btnAutorizar").double_click_input()
    r = terminar(proc, js)
    assert r["recibos_verificacion"] == 1 and r["verificada_persistida"] is True, r
    assert esperar_sin_ventana()
    return {"recibos": r["recibos_verificacion"], "autorizacion": "SIMULADA"}


def c_concurrencia():
    proc, js = lanzar("concurrencia")
    w = ventana()
    time.sleep(3)
    abiertas = len(Desktop(backend="uia").windows(title_re=TITULO, visible_only=True))
    control(w, "btnNoAutorizar").click_input()
    r = terminar(proc, js)
    codigos = sorted(x.get("resultado_codigo") for x in r["resultados"])
    assert abiertas == 1, f"ventanas abiertas a la vez: {abiertas}"
    assert codigos == ["RECHAZADO_POR_LA_PERSONA", "SOLICITUD_EN_CURSO"], codigos
    assert r["recibos_verificacion"] == 0
    return {"ventanas_simultaneas": abiertas, "codigos": codigos}


def c_scroll(escala):
    def f():
        proc, js = lanzar(f"scroll_{escala}", "--escala", escala)
        w = ventana()
        sv = w.child_window(auto_id="scrollContenido").wrapper_object()
        try:
            sv.iface_scroll.SetScrollPercent(-1, 100)
        except Exception:
            keyboard.send_keys("^{END}")
        time.sleep(0.4)
        img = captura(w, f"ventana_scroll_escala_{escala.replace('.', '_')}")
        for aid in ("btnAutorizar", "btnNoAutorizar", "chkRevisado"):
            assert dentro(w, control(w, aid)), f"{aid} fuera de la ventana tras desplazar"
        control(w, "btnNoAutorizar").click_input()
        r = terminar(proc, js)
        no_verificada(r, "RECHAZADO_POR_LA_PERSONA")
        return {"captura": img}
    return f


if os.name != "nt":
    print("Requiere Windows con escritorio interactivo.")
    sys.exit(2)

caso("contenido, controles y confirmación (escala 100 %)", c_contenido_y_confirmar("1"))
caso("contenido y confirmación con escala de diseño 125 %", c_contenido_y_confirmar("1.25"))
caso("contenido y confirmación con escala de diseño 150 %", c_contenido_y_confirmar("1.5"))
caso("desplazamiento con escala 150 %: botones siempre accesibles", c_scroll("1.5"))
caso("rechazo con el botón «No confirmar»", c_rechazo)
caso("Enter sobre «No confirmar» = rechazo explícito", c_enter_sobre_no)
caso("Esc = cerrada sin respuesta", c_tecla("esc", "{ESC}", "VENTANA_CERRADA_SIN_RESPUESTA"))
caso("Alt+F4 = cerrada sin respuesta", c_tecla("altf4", "%{F4}", "VENTANA_CERRADA_SIN_RESPUESTA"))
caso("tiempo agotado", c_timeout)
caso("error técnico (proceso de la ventana terminado)", c_error_tecnico)
caso("navegación con Tab y confirmación solo con teclado", c_teclado_confirma)
caso("doble clic en confirmar = un solo recibo", c_doble_clic)
caso("dos solicitudes simultáneas = una sola ventana", c_concurrencia)

informe = {"herramienta": "pywinauto (UI Automation, backend uia)", "advertencia": "Autorizaciones SIMULADAS por UI Automation; no son aceptación humana. La escala 125/150 % es escala de diseño WPF (LayoutTransform), no cambio de DPI del sistema.", "casos": resultados, "ok": all(r["ok"] for r in resultados)}
(SALIDA / "informe-gui.json").write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
sys.exit(0 if informe["ok"] else 1)
