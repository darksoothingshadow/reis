# REIS.mendelu

> **Zjednodušit a měřitelně zrychlit každodenní práci studentů s Informačním systémem MENDELU.**

REIS.mendelu je rozšíření prohlížeče, které zpřehledňuje a personalizuje Informační systém. Pracuje čistě na straně klienta – přímo v prohlížeči studenta – a nijak nezasahuje do samotného IS.

---

## 🎯 Proč REIS?

| Problém | Řešení |
|---------|--------|
| Zbytečně mnoho kliknutí pro základní úkoly | **Pravidlo tří kliknutí** – vše důležité max. na 3 kliky |
| Zobrazování nerelevantních informací | **Kontextová priorita** – nejdříve váš semestr, pak obor, fakulta, univerzita |
| Informace roztříštěné na mnoha místech | **Vertikální integrace** – klik na předmět = materiály + vyučující + termíny najednou |

---

## ✨ Klíčové funkce

- **Personalizovaný Dashboard** – přehled toho, co je právě důležité
- **Inteligentní propojení dat** – související informace pohromadě
- **Kontextová personalizace** – obsah přizpůsobený vašemu oboru a ročníku

---

## 🚀 Instalace

1. Stáhněte si rozšíření: [tinyurl.com/reismendelu](https://tinyurl.com/reismendelu)
2. Otevřete [is.mendelu.cz](https://is.mendelu.cz)
3. Přihlaste se
4. Rozšíření se automaticky načte

---

## 👥 Tým

| Jméno | Role |
|-------|------|
| Dominik Holek | Vedoucí projektu, datová analýza |
| Tomáš Vymazal | Technický vedoucí, designér |
| Antonín Dědeček | Produktový a komunitní manažer |
| Kryštof Janda | Výzkum a inovace |

---

## 📅 Roadmap

| Fáze | Období | Status |
|------|--------|--------|
| Vývoj a interní testování | ZS 2025/2026 | 🔄 Probíhá |
| Sběr a analýza zpětné vazby | ZS 2025/2026 | ⏳ Plánováno |
| Finální úpravy a veřejné vydání | LS 2025/2026 | ⏳ Plánováno |

---

## 🔒 Soukromí

Rozšíření pracuje výhradně lokálně ve vašem prohlížeči. Žádná data neopouštějí váš počítač. Více v [PRIVACY.md](PRIVACY.md).

---

## 🧪 Testing

This project uses **Vitest** for unit tests and **Playwright** for E2E testing of the Chrome extension.

```bash
# Unit tests
npm run test              # Watch mode
npm run test:run          # Single run

# E2E tests (requires Xvfb on Linux)
npm run build:quick       # Build extension first
npm run test:e2e          # Run all E2E tests

# Visual proof screenshots
xvfb-run playwright test visual-proof.spec.ts
```

### Visual Feedback Loop

The `/screenshot` workflow captures the extension UI state:
- `proof-calendar.png` — Calendar view
- `proof-exams.png` — Exam timeline
- `proof-search.png` — Search results

See [`e2e/README.md`](e2e/README.md) for detailed E2E documentation.

---

## 🛠️ Pro vývojáře

```bash
# Instalace závislostí
npm install

# Spuštění dev serveru
npm run dev

# Build rozšíření
npm run build
```

---

*Nezávislá studentská iniciativa • Provozně ekonomická fakulta • MENDELU*
