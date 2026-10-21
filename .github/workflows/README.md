# Elpriser för elidag.se

Det här förrådet innehåller inget annat än elpriser och koden som hämtar dem.
Sajten [elidag.se](https://elidag.se) läser filerna i `data/` så att den fungerar
även när priskällorna ligger nere.

## Hur det fungerar

`hamta-priser.js` körs av GitHub Actions några gånger per dygn och sparar en fil
per elområde i `data/`:

- `data/SE1.json` – Luleå
- `data/SE2.json` – Sundsvall
- `data/SE3.json` – Stockholm
- `data/SE4.json` – Malmö

Varje fil innehåller dagens och, när de publicerats, morgondagens priser i öre per
kWh, kvart för kvart. Priserna är spotpriser utan moms, skatter, nätavgift och
elbolagets påslag.

## Källor

1. [elprisetjustnu.se](https://www.elprisetjustnu.se) – används i första hand, har priserna i kronor.
2. [spot-hinta.fi](https://api.spot-hinta.fi) – reserv när den första inte svarar. Priserna är i euro
   och räknas om med dagskursen från [open.er-api.com](https://open.er-api.com).

Går en källa ner används den andra. Går båda ner behålls den senast sparade filen,
så sajten visar fortfarande priser.

## Köra för hand

Jobbet kan startas manuellt under fliken **Actions → Hämta elpriser → Run workflow**.
Lokalt räcker `node hamta-priser.js`, utan att något behöver installeras.
