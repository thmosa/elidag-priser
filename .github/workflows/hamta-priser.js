// Hämtar elpriser för SE1–SE4 och sparar dem som enkla JSON-filer.
// Körs av GitHub Actions några gånger per dygn. Inga beroenden.

const fs = require('fs');
const path = require('path');

const OMRADEN = ['SE1', 'SE2', 'SE3', 'SE4'];
const UTMAPP = path.join(__dirname, 'data');

const datumStr = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// ---- Källa 1: elprisetjustnu.se (priser direkt i kronor) ----
async function franElprisetJustNu(omrade, datum) {
    const [ar, man, dag] = datumStr(datum).split('-');
    const res = await fetch(`https://www.elprisetjustnu.se/api/v1/prices/${ar}/${man}-${dag}_${omrade}.json`);
    if (!res.ok) throw new Error('elprisetjustnu svarade ' + res.status);
    const data = await res.json();
    if (!data.length) throw new Error('elprisetjustnu gav tomt svar');

    return data.map((i) => ({
        start: i.time_start,
        ore: Math.round(i.SEK_per_kWh * 1000) / 10
    }));
}

// ---- Källa 2: spot-hinta.fi (priser i euro, räknas om) ----
let kursLofte = null;
async function eurTillSek() {
    if (!kursLofte) {
        kursLofte = (async () => {
            const res = await fetch('https://open.er-api.com/v6/latest/EUR');
            const data = await res.json();
            if (!data || !data.rates || !data.rates.SEK) throw new Error('Fick ingen valutakurs');
            return data.rates.SEK;
        })();
    }
    return kursLofte;
}

async function franSpotHinta(omrade, datum) {
    const [res, kurs] = await Promise.all([
        fetch('https://api.spot-hinta.fi/TodayAndDayForward?region=' + omrade),
        eurTillSek()
    ]);
    if (!res.ok) throw new Error('spot-hinta svarade ' + res.status);
    const data = await res.json();

    const vill = datumStr(datum);
    const punkter = data
        .map((i) => ({ d: new Date(i.DateTime), eur: i.PriceNoTax }))
        .filter((p) => datumStr(p.d) === vill)
        .map((p) => ({
            start: p.d.toISOString(),
            ore: Math.round(p.eur * kurs * 1000) / 10
        }));

    if (!punkter.length) throw new Error('spot-hinta saknar ' + vill);
    return punkter;
}

async function hamta(omrade, datum) {
    try {
        const priser = await franElprisetJustNu(omrade, datum);
        return { priser, kalla: 'elprisetjustnu.se' };
    } catch (e1) {
        console.log(`  ${omrade} ${datumStr(datum)}: huvudkällan misslyckades (${e1.message}), provar reserven`);
        const priser = await franSpotHinta(omrade, datum);
        return { priser, kalla: 'spot-hinta.fi' };
    }
}

async function main() {
    fs.mkdirSync(UTMAPP, { recursive: true });

    const idag = new Date();
    const imorgon = new Date(idag);
    imorgon.setDate(idag.getDate() + 1);

    let lyckade = 0;

    for (const omrade of OMRADEN) {
        const resultat = { omrade, uppdaterad: new Date().toISOString(), dagar: {} };

        for (const datum of [idag, imorgon]) {
            try {
                const { priser, kalla } = await hamta(omrade, datum);
                resultat.dagar[datumStr(datum)] = { kalla, priser };
                console.log(`  ${omrade} ${datumStr(datum)}: ${priser.length} kvartar från ${kalla}`);
            } catch (e) {
                // Morgondagens priser finns först runt kl. 13, så det här är ofta helt normalt
                console.log(`  ${omrade} ${datumStr(datum)}: ingen data (${e.message})`);
            }
        }

        if (!Object.keys(resultat.dagar).length) {
            console.log(`  ${omrade}: inget att spara, behåller den gamla filen`);
            continue;
        }

        const fil = path.join(UTMAPP, omrade + '.json');
        fs.writeFileSync(fil, JSON.stringify(resultat));
        lyckade++;
    }

    if (!lyckade) {
        console.error('Ingen källa svarade för något elområde.');
        process.exit(1);
    }
    console.log(`Klart: ${lyckade} av ${OMRADEN.length} elområden uppdaterade.`);
}

main();
