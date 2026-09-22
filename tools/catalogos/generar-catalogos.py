#!/usr/bin/env python3
"""Regenera los catálogos de ubicación, nacionalidad y ocupación del frontend.

Uso:  python3 tools/catalogos/generar-catalogos.py [--solo ubicaciones|persona]

Escribe dos archivos (ambos GENERADOS: no editarlos a mano):

  apps/reclusorio-web/public/catalogos/ubicaciones.json
      país → estado → municipio.
      · México: servicio de catálogos geoestadísticos del INEGI
        (gaia.inegi.org.mx/wscatgeo) — 32 entidades y sus 2 478 municipios y
        demarcaciones territoriales, con la clave geoestadística oficial.
      · Resto del mundo: Wikidata — países con ISO 3166-1 alpha-2 vigente y sus
        divisiones de primer nivel. SIN municipios: no hay una fuente homogénea
        que los cubra con calidad pareja (se probaron Wikidata y OSM), y un
        listado incompleto que aparenta ser oficial es peor que no tenerlo.

  apps/reclusorio-web/src/app/core/persona-opciones.data.ts
      · NACIONALIDADES: gentilicio en femenino singular ("nacionalidad
        mexicana") de cada país, tomado de la ficha de Wikipedia en español y
        derivado al femenino con las reglas de género del castellano.
      · OCUPACIONES: grupos unitarios de la CIUO-08 (ISCO-08) en español,
        servidos por la API de ESCO. Es la clasificación en la que se basa el
        SINCO del INEGI.

Las tres fuentes son públicas y no requieren credenciales. El script es
idempotente: siempre ordena y deduplica, así que dos corridas seguidas con las
mismas fuentes producen archivos idénticos.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA_UBICACIONES = RAIZ / 'apps/reclusorio-web/public/catalogos/ubicaciones.json'
SALIDA_PERSONA = RAIZ / 'apps/reclusorio-web/src/app/core/persona-opciones.data.ts'

AGENTE = {'User-Agent': 'plataforma-reclusorio/catalogos (contacto: equipo de desarrollo)'}
INEGI = 'https://gaia.inegi.org.mx/wscatgeo/v2'
WIKIDATA = 'https://query.wikidata.org/sparql'
WIKIPEDIA = 'https://es.wikipedia.org/w/api.php'
ESCO = 'https://ec.europa.eu/esco/api/resource'
ISCO = 'http://data.europa.eu/esco/concept-scheme/isco'


def pedir(url: str, intentos: int = 5, espera: int = 15) -> bytes:
    """GET con reintentos: Wikidata responde 429/504 cuando está saturado."""
    ultimo: Exception | None = None
    for i in range(intentos):
        try:
            return urllib.request.urlopen(
                urllib.request.Request(url, headers=AGENTE), timeout=120
            ).read()
        except Exception as error:  # noqa: BLE001 - se reintenta cualquier fallo de red
            ultimo = error
            print(f'  reintento {i + 1}/{intentos}: {error}', file=sys.stderr)
            time.sleep(espera)
    raise SystemExit(f'No se pudo descargar {url}: {ultimo}')


def orden_es(texto: str) -> str:
    """Clave de orden alfabético en español: ignora acentos y mayúsculas."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', texto.lower()) if not unicodedata.combining(c)
    )


def json_de(url: str) -> dict:
    return json.loads(pedir(url))


def sparql(consulta: str) -> list[dict]:
    url = f'{WIKIDATA}?format=json&query={urllib.parse.quote(consulta)}'
    return json_de(url)['results']['bindings']


# --------------------------------------------------------------------------
# Ubicaciones
# --------------------------------------------------------------------------

# El modelo del proyecto usa el nombre corto de uso común; los nombres
# constitucionales largos ya están en ALIAS_UBICACION (core/ubicaciones.ts),
# así que los registros capturados con ellos siguen canonizando.
NOMBRE_ESTADO_MX = {
    'Coahuila de Zaragoza': 'Coahuila',
    'Michoacán de Ocampo': 'Michoacán',
    'Veracruz de Ignacio de la Llave': 'Veracruz',
    'México': 'Estado de México',
}

NOMBRE_PAIS = {
    'Reino de los Países Bajos': 'Países Bajos',
    'República Popular China': 'China',
    'República de China': 'Taiwán',
    'Estados Federados de Micronesia': 'Micronesia',
    'Mali': 'Malí',
    'Suazilandia': 'Esuatini',
}

# Wikidata etiqueta las divisiones con su tipo ("Departamento de Sololá").
# Solo se recorta cuando hay conector "de"/"del", para no mutilar nombres
# propios como "Distrito Federal", "División Este" o "Isla de la Juventud".
PREFIJO_DIVISION = re.compile(
    r'^(?:estado|provincia|departamento|región|region|gobernación|gobernacion|'
    r'prefectura|óblast|oblast|condado|cantón|canton|municipio|comuna|parroquia|'
    r'división|division|circunscripción|circunscripcion)'
    r'\s+del?\s+',
    re.I,
)


def nombre_corto(nombre: str) -> str:
    corto = PREFIJO_DIVISION.sub('', nombre).strip()
    return nombre if len(corto) < 3 or corto[0].islower() else corto


def estados_de_mexico() -> list[dict]:
    """32 entidades federativas con sus municipios, desde el INEGI."""
    entidades = json_de(f'{INEGI}/mgee/')['datos']
    estados = []
    for entidad in entidades:
        clave = entidad['cve_ent']
        filas = json_de(f'{INEGI}/mgem/{clave}')['datos']
        nombres = [f['nomgeo'].strip() for f in filas]
        # Oaxaca tiene municipios homónimos (San Juan y San Pedro Mixtepec):
        # se distinguen con la clave geoestadística para no perder ninguno.
        repetidos = {n for n in nombres if nombres.count(n) > 1}
        municipios = sorted(
            {
                f"{f['nomgeo'].strip()} ({f['cvegeo']})"
                if f['nomgeo'].strip() in repetidos
                else f['nomgeo'].strip()
                for f in filas
            }
        )
        estados.append(
            {
                'nombre': NOMBRE_ESTADO_MX.get(entidad['nomgeo'], entidad['nomgeo']),
                'municipios': municipios,
            }
        )
        print(f'  INEGI {clave} {entidad["nomgeo"]}: {len(municipios)} municipios')
    return sorted(estados, key=lambda e: e['nombre'])


CONSULTA_PAISES = """
SELECT DISTINCT ?iso ?nombre ?articulo WHERE {
  ?pais wdt:P31 wd:Q3624078 ; wdt:P297 ?iso ; rdfs:label ?nombre .
  FILTER NOT EXISTS { ?pais wdt:P576 ?disolucion }
  FILTER(lang(?nombre) = "es")
  OPTIONAL { ?articulo schema:about ?pais ; schema:isPartOf <https://es.wikipedia.org/> }
}
"""

CONSULTA_DIVISIONES = """
SELECT ?iso ?div ?divLabel WHERE {
  ?pais wdt:P31 wd:Q3624078 ; wdt:P297 ?iso ; wdt:P150 ?div .
  FILTER NOT EXISTS { ?pais wdt:P576 ?disolucion }
  FILTER NOT EXISTS { ?div wdt:P576 ?extincion }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
}
"""


def paises_wikidata() -> dict[str, dict]:
    paises = {}
    for fila in sparql(CONSULTA_PAISES):
        nombre = fila['nombre']['value']
        articulo = ''
        if 'articulo' in fila:
            articulo = urllib.parse.unquote(
                fila['articulo']['value'].rsplit('/', 1)[-1]
            ).replace('_', ' ')
        paises[fila['iso']['value']] = {
            'nombre': NOMBRE_PAIS.get(nombre, nombre),
            'articulo': articulo,
        }
    return paises


def divisiones_wikidata() -> dict[str, set[str]]:
    divisiones: dict[str, set[str]] = {}
    for fila in sparql(CONSULTA_DIVISIONES):
        iso = fila['iso']['value']
        if iso == 'MX':  # México viene del INEGI, que es la fuente oficial
            continue
        etiqueta = fila['divLabel']['value'].strip()
        if re.fullmatch(r'Q\d+', etiqueta):  # sin etiqueta en es/en
            continue
        divisiones.setdefault(iso, set()).add(nombre_corto(etiqueta))
    return divisiones


def generar_ubicaciones(paises: dict[str, dict]) -> None:
    print('Ubicaciones: descargando municipios del INEGI…')
    mexico = estados_de_mexico()
    print('Ubicaciones: descargando divisiones de primer nivel de Wikidata…')
    divisiones = divisiones_wikidata()

    salida = [{'nombre': 'México', 'estados': mexico}]
    for iso in sorted((i for i in paises if i != 'MX'), key=lambda i: paises[i]['nombre']):
        salida.append(
            {
                'nombre': paises[iso]['nombre'],
                'estados': [
                    {'nombre': n, 'municipios': []} for n in sorted(divisiones.get(iso, []))
                ],
            }
        )

    # Un país por línea: el archivo es generado, pero el diff sigue siendo legible.
    cuerpo = ',\n'.join(json.dumps(p, ensure_ascii=False, separators=(',', ':')) for p in salida)
    SALIDA_UBICACIONES.parent.mkdir(parents=True, exist_ok=True)
    SALIDA_UBICACIONES.write_text('{"paises":[\n' + cuerpo + '\n]}\n', encoding='utf-8')
    municipios = sum(len(e['municipios']) for e in mexico)
    estados = sum(len(p['estados']) for p in salida)
    print(
        f'→ {SALIDA_UBICACIONES.relative_to(RAIZ)}: {len(salida)} países, '
        f'{estados} estados, {municipios} municipios de México'
    )


# --------------------------------------------------------------------------
# Nacionalidades (gentilicios)
# --------------------------------------------------------------------------

# La ficha de Wikipedia deja estos casos con varias formas, vacíos o con el
# gentilicio en masculino dentro de una frase; se fijan a mano.
GENTILICIO_FIJO = {
    'BA': 'Bosnia',
    'BD': 'Bangladesí',
    'BH': 'Bareiní',
    'CR': 'Costarricense',
    'GM': 'Gambiana',
    'KE': 'Keniana',
    'KG': 'Kirguisa',
    'MA': 'Marroquí',
    'ML': 'Maliense',
    'PK': 'Pakistaní',
    'SA': 'Saudí',
    'SZ': 'Suazi',
    'TL': 'Timorense',
    'US': 'Estadounidense',
}

SIN_ACENTO = str.maketrans('áéíóú', 'aeiou')


def femenino(masculino: str) -> str | None:
    """Femenino singular del gentilicio según las reglas del castellano."""
    if not masculino or len(masculino) < 3:
        return None
    palabra = masculino[0].upper() + masculino[1:].lower()
    fin = palabra.lower()
    if fin.endswith(('a', 'e', 'í', 'ú', 'i', 'u')):
        return palabra  # belga, canadiense, marroquí, israelí
    if fin.endswith('o'):
        return palabra[:-1] + 'a'  # mexicano → mexicana
    if fin.endswith('és'):
        return palabra[:-2] + 'esa'  # francés → francesa
    if fin.endswith(('án', 'ín', 'ón')):  # alemán → alemana, letón → letona
        return palabra[:-2] + palabra[-2].translate(SIN_ACENTO) + palabra[-1] + 'a'
    if fin.endswith(('l', 'n', 's', 'r', 'z')):
        return palabra + 'a'  # español → española, mongol → mongola
    return palabra


def limpiar_ficha(bruto: str) -> str:
    """Deja el primer gentilicio del campo, sin plantillas ni enlaces wiki."""
    texto = re.sub(r'<ref[^>]*>.*?</ref>', ' ', bruto, flags=re.S)
    texto = re.sub(r'<ref[^>]*/>', ' ', texto)
    texto = re.sub(r'\{\{[^{}]*\}\}', ' ', texto)
    texto = re.sub(r'\[\[[^\]|]*\|([^\]]*)\]\]', r'\1', texto)
    texto = re.sub(r'\[\[([^\]]*)\]\]', r'\1', texto)
    texto = re.sub(r'\[\[[^\]|]*\|', ' ', texto)
    texto = re.sub(r"'''?|<[^>]*>|&[a-z]+;|\{\{|\}\}", ' ', texto)
    texto = re.split(r'[,;/()]|\s-\s|\s+o\s+|\s+y\s+|\s+también\s+', texto)[0]
    texto = re.sub(r'\s+', ' ', texto).strip(' .-–— ')
    return texto.split()[0] if texto else ''


def nacionalidades(paises: dict[str, dict]) -> list[str]:
    print('Nacionalidades: leyendo las fichas de Wikipedia en español…')
    titulos = sorted({p['articulo'] for p in paises.values() if p['articulo']})
    fichas: dict[str, str] = {}
    for i in range(0, len(titulos), 40):
        lote = titulos[i : i + 40]
        datos = json_de(
            f'{WIKIPEDIA}?action=query&prop=revisions&rvprop=content&rvslots=main'
            f'&format=json&redirects=1&titles={urllib.parse.quote("|".join(lote))}'
        )['query']
        redirige = {n['from']: n['to'] for n in datos.get('normalized', [])}
        redirige.update({r['from']: r['to'] for r in datos.get('redirects', [])})
        origen: dict[str, str] = {}
        for titulo in lote:
            origen.setdefault(redirige.get(titulo, titulo), titulo)
        for pagina in datos['pages'].values():
            if 'revisions' in pagina:
                fichas[origen.get(pagina['title'], pagina['title'])] = pagina['revisions'][0][
                    'slots'
                ]['main']['*']
        time.sleep(1)

    valores: set[str] = set()
    for iso, pais in paises.items():
        fijo = GENTILICIO_FIJO.get(iso)
        if fijo:
            valores.add(fijo)
            continue
        campo = re.search(r'\|\s*gentilicio\s*=\s*(.+)', fichas.get(pais['articulo'], ''), re.I)
        gentilicio = femenino(limpiar_ficha(campo.group(1))) if campo else None
        if not gentilicio:
            raise SystemExit(f'Sin gentilicio para {iso} ({pais["nombre"]}): agrégalo a GENTILICIO_FIJO')
        valores.add(gentilicio)
    # Mexicana primero: es el valor de la inmensa mayoría de los registros.
    return ['Mexicana'] + sorted(valores - {'Mexicana'}, key=orden_es)


# --------------------------------------------------------------------------
# Ocupaciones (CIUO-08 / ISCO-08 en español, vía ESCO)
# --------------------------------------------------------------------------


def hijos_isco(uri: str) -> list[tuple[str, str]]:
    """(uri, título) de los grupos que cuelgan de `uri`; ESCO ya trae el título."""
    datos = json_de(f'{ESCO}/concept?uri={urllib.parse.quote(uri, safe="")}&language=es')
    return [
        (h['uri'], h['title'].strip())
        for h in datos.get('_links', {}).get('narrowerConcept', [])
    ]


def ocupaciones() -> list[str]:
    """Grupos unitarios (4.º nivel) de la CIUO-08: ocupaciones concretas."""
    print('Ocupaciones: recorriendo la CIUO-08 en la API de ESCO…')
    raiz = json_de(f'{ESCO}/taxonomy?uri={urllib.parse.quote(ISCO, safe="")}&language=es')
    nivel = [(t['uri'], t['title']) for t in raiz['_links']['hasTopConcept']]
    for profundidad in range(3):  # grandes grupos → subgrupos → primarios → unitarios
        with ThreadPoolExecutor(8) as pool:
            nivel = [x for lote in pool.map(hijos_isco, [u for u, _ in nivel]) for x in lote]
        print(f'  nivel {profundidad + 2}: {len(nivel)} grupos')
    return sorted({t[0].upper() + t[1:] for _, t in nivel if t}, key=orden_es)


# --------------------------------------------------------------------------


CABECERA_TS = '''/**
 * ARCHIVO GENERADO — no editar a mano.
 * Se regenera con: python3 tools/catalogos/generar-catalogos.py --solo persona
 *
 * NACIONALIDADES: los {n_nac} gentilicios distintos de los países con ISO 3166-1
 * vigente, en femenino singular ("nacionalidad mexicana"), tomados de la ficha
 * de Wikipedia en español. Son menos que los países porque algunos comparten
 * gentilicio. Mexicana va primero: es el valor de la mayoría de los registros.
 *
 * OCUPACIONES: los {n_ocu} grupos unitarios de la CIUO-08 (ISCO-08) en español,
 * servidos por la API de ESCO. Es la clasificación internacional en la que se
 * basa el SINCO del INEGI.
 */

export const NACIONALIDADES: string[] = [
{nacionalidades}
];

export const OCUPACIONES: string[] = [
{ocupaciones}
];
'''


def escribir_persona(nacs: list[str], ocus: list[str]) -> None:
    def lista(valores: list[str]) -> str:
        return '\n'.join(f"  '{v}'," for v in valores)

    SALIDA_PERSONA.write_text(
        CABECERA_TS.format(
            n_nac=len(nacs),
            n_ocu=len(ocus),
            nacionalidades=lista(nacs),
            ocupaciones=lista(ocus),
        ),
        encoding='utf-8',
    )
    print(
        f'→ {SALIDA_PERSONA.relative_to(RAIZ)}: '
        f'{len(nacs)} nacionalidades, {len(ocus)} ocupaciones'
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--solo', choices=['ubicaciones', 'persona'])
    args = parser.parse_args()

    print('Países: consultando Wikidata (ISO 3166-1)…')
    paises = paises_wikidata()
    print(f'  {len(paises)} países vigentes')

    if args.solo != 'persona':
        generar_ubicaciones(paises)
    if args.solo != 'ubicaciones':
        escribir_persona(nacionalidades(paises), ocupaciones())


if __name__ == '__main__':
    main()
