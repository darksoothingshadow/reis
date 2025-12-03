// Pages data for search functionality
export interface PageItem {
    id: string;
    label: string;
    path: string;
    keywords: string[];
}

export interface PageCategory {
    id: string;
    label: string;
    items: PageItem[];
}

export const pagesData: PageCategory[] = [
    {
        "id": "cat_studium",
        "label": "Moje studium",
        "items": [
            {
                "id": "predmety_dochazka",
                "label": "Předměty a docházka",
                "path": "/auth/student/list.pl?lang=cz",
                "keywords": ["rozvrh", "absence", "materiály", "soubory", "osnovy"]
            },
            {
                "id": "prubeh_semestru",
                "label": "Průběh semestru",
                "path": "/auth/student/pruchod_studiem.pl?lang=cz",
                "keywords": ["známky", "zkoušky", "termíny", "kredity"]
            },
            {
                "id": "odevzdavarna",
                "label": "Odevzdávárna",
                "path": "/auth/student/odevzdavarny.pl?lang=cz",
                "keywords": ["odevzdání", "úkoly", "soubory", "seminárka"]
            },
            {
                "id": "kontrola_planu",
                "label": "Kontrola plánu studia",
                "path": "/auth/studijni/studijni_povinnosti.pl?lang=cz",
                "keywords": ["kredity", "splněno", "povinnosti", "předměty"]
            },
            {
                "id": "studijni_plany",
                "label": "Studijní plány",
                "path": "/auth/katalog/plany.pl?lang=cz",
                "keywords": ["katalog", "předměty", "obor", "struktura"]
            },
            {
                "id": "hodnoceni_uspesnosti",
                "label": "Hodnocení úspěšnosti",
                "path": "/auth/student/hodnoceni.pl?lang=cz",
                "keywords": ["statistika", "obtížnost", "historie", "úmrtnost"]
            },
            {
                "id": "spoluzaci",
                "label": "Spolužáci",
                "path": "/auth/student/spoluzaci.pl?lang=cz",
                "keywords": ["lidé", "kontakt", "email"]
            },
            {
                "id": "info_studium",
                "label": "Informace o studiu",
                "path": "/auth/student/studium.pl?lang=cz",
                "keywords": ["zápis", "obor", "stav"]
            }
        ]
    },
    {
        "id": "cat_zkousky",
        "label": "Zkoušky a testy",
        "items": [
            {
                "id": "zkousky",
                "label": "Zkoušky (Termíny)",
                "path": "/auth/student/terminy_seznam.pl?lang=cz",
                "keywords": ["přihlašování", "termíny", "kalendář", "zkouškové"]
            },
            {
                "id": "testy",
                "label": "Online testy",
                "path": "/auth/elis/ot/psani_testu.pl?lang=cz",
                "keywords": ["e-learning", "zkoušení", "odpovědník"]
            },
            {
                "id": "cvicne_testy",
                "label": "Cvičné testy",
                "path": "/auth/elis/student/seznam_osnov.pl?lang=cz",
                "keywords": ["procvičování", "otázky", "příprava"]
            },
            {
                "id": "zapisy_predmetu",
                "label": "Zápisy předmětů",
                "path": "/auth/student/registrace.pl?lang=cz",
                "keywords": ["registrace", "kroužky", "rozvrh"]
            },
            {
                "id": "harmonogram",
                "label": "Harmonogram roku",
                "path": "/auth/student/harmonogram.pl?lang=cz",
                "keywords": ["kalendář", "zkouškové", "semestr", "volno"]
            }
        ]
    },
    {
        "id": "cat_administrativa",
        "label": "Administrativa a finance",
        "items": [
            {
                "id": "potvrzeni_studium",
                "label": "Potvrzení o studiu",
                "path": "/auth/student/tisk_dokumentu.pl?lang=cz",
                "keywords": ["pdf", "tisk", "dokumenty", "úřad"]
            },
            {
                "id": "zadosti_dashboard",
                "label": "Přehled žádostí (KC)",
                "path": "/auth/kc/kc.pl?lang=cz",
                "keywords": ["kontaktní centrum", "formuláře", "úřadovna", "podání"]
            },
            {
                "id": "bankovni_spojeni",
                "label": "Bankovní informace",
                "path": "/auth/student/bank_spojeni_clovek.pl?lang=cz",
                "keywords": ["účet", "číslo účtu", "stipendium", "výplata"]
            },
            {
                "id": "objednavky",
                "label": "Objednávky a platby",
                "path": "/auth/financovani/objednavky.pl?lang=cz",
                "keywords": ["platby", "nákup", "koleje", "menza"]
            },
            {
                "id": "ubytovaci_stipendium",
                "label": "Ubytovací stipendium",
                "path": "/auth/student/zadost_ubyt_stip.pl?lang=cz",
                "keywords": ["koleje", "peníze", "žádost"]
            },
            {
                "id": "wifi",
                "label": "Nastavení Wi-Fi (Eduroam)",
                "path": "/auth/wifi/certifikat.pl?lang=cz",
                "keywords": ["wifi", "wi-fi", "eduroam", "internet", "heslo", "certifikát", "připojení"]
            }
        ]
    },
    {
        "id": "cat_form_studium",
        "label": "Formuláře: Průběh studia",
        "items": [
            {
                "id": "form_omluvenka",
                "label": "Omluvenka (Hlášenka absence)",
                "path": "/auth/kc/kc.pl?formular=56;zalozka=novy;lang=cz",
                "keywords": ["nemoc", "lékař", "omluvení", "nepřítomnost", "absence"]
            },
            {
                "id": "form_obecna",
                "label": "Obecná žádost",
                "path": "/auth/kc/kc.pl?formular=3;zalozka=novy;lang=cz",
                "keywords": ["univerzální", "dopis", "rektor", "děkan", "ostatní"]
            },
            {
                "id": "form_preruseni",
                "label": "Žádost o přerušení studia",
                "path": "/auth/kc/kc.pl?formular=31;zalozka=novy;lang=cz",
                "keywords": ["pauza", "odklad", "ukončení dočasné", "přerušit"]
            },
            {
                "id": "form_opetovny_zapis",
                "label": "Opětovný zápis po přerušení",
                "path": "/auth/kc/kc.pl?formular=32;zalozka=novy;lang=cz",
                "keywords": ["návrat", "pokračování", "zápis", "reaktivace"]
            },
            {
                "id": "form_uznani_predmetu",
                "label": "Žádost o uznání předmětů",
                "path": "/auth/kc/kc.pl?formular=35;zalozka=novy;lang=cz",
                "keywords": ["kredity", "předchozí studium", "uznávání", "ECTS"]
            },
            {
                "id": "form_mimoradny_zapis",
                "label": "Mimořádný zápis (nedostatek kreditů)",
                "path": "/auth/kc/kc.pl?formular=4;zalozka=novy;lang=cz",
                "keywords": ["výjimka", "pokračování", "podmíněný", "děkan"]
            },
            {
                "id": "form_zruseni_predmetu",
                "label": "Zrušení zápisu předmětu",
                "path": "/auth/kc/kc.pl?formular=6;zalozka=novy;lang=cz",
                "keywords": ["odhlášení", "výmaz", "storno", "předmět"]
            },
            {
                "id": "form_zmena_formy",
                "label": "Změna formy studia",
                "path": "/auth/kc/kc.pl?formular=37;zalozka=novy;lang=cz",
                "keywords": ["prezenční", "kombinované", "přestup"]
            },
            {
                "id": "form_komisionalni",
                "label": "Povolení komisionální zkoušky",
                "path": "/auth/kc/kc.pl?formular=44;zalozka=novy;lang=cz",
                "keywords": ["opravný termín", "poslední pokus", "komise", "děkan"]
            },
            {
                "id": "form_zanechani",
                "label": "Prohlášení o zanechání studia",
                "path": "/auth/kc/kc.pl?formular=97;zalozka=novy;lang=cz",
                "keywords": ["konec", "ukončení", "výstup"]
            },
            {
                "id": "form_odvolani",
                "label": "Odvolání proti rozhodnutí",
                "path": "/auth/kc/kc.pl?formular=47;zalozka=novy;lang=cz",
                "keywords": ["stížnost", "přezkum", "ukončení studia", "poplatky"]
            }
        ]
    },
    {
        "id": "cat_form_spec",
        "label": "Formuláře: Specializace a závěrečné práce",
        "items": [
            {
                "id": "form_zmena_vedouciho",
                "label": "Změna vedoucího závěrečné práce",
                "path": "/auth/kc/kc.pl?formular=45;zalozka=novy;lang=cz",
                "keywords": ["školitel", "téma", "bp", "dp", "bakalářka"]
            },
            {
                "id": "form_odlozeni_prace",
                "label": "Odložení zpřístupnění záv. práce",
                "path": "/auth/kc/kc.pl?formular=53;zalozka=novy;lang=cz",
                "keywords": ["bakalářka", "diplomka", "tajné", "utajení", "publikace"]
            },
            {
                "id": "form_specializace",
                "label": "Žádost o přiřazení specializace",
                "path": "/auth/kc/kc.pl?formular=103;zalozka=novy;lang=cz",
                "keywords": ["zaměření", "obor", "modul"]
            }
        ]
    },
    {
        "id": "cat_form_fin",
        "label": "Formuláře: Stipendia a poplatky",
        "items": [
            {
                "id": "form_stipendium",
                "label": "Žádost o stipendium",
                "path": "/auth/kc/kc.pl?formular=38;zalozka=novy;lang=cz",
                "keywords": ["prospěchové", "mimořádné", "peníze", "výplata"]
            },
            {
                "id": "form_soc_stipendium",
                "label": "Žádost o sociální stipendium",
                "path": "/auth/kc/kc.pl?formular=75;zalozka=novy;lang=cz",
                "keywords": ["sociální situace", "peníze", "podpora"]
            },
            {
                "id": "form_poukazky",
                "label": "Navýšení registračních poukázek",
                "path": "/auth/kc/kc.pl?formular=43;zalozka=novy;lang=cz",
                "keywords": ["registrace", "kroužky", "limit", "navýšení"]
            }
        ]
    },
    {
        "id": "cat_form_erasmus",
        "label": "Formuláře: Zahraničí (Erasmus)",
        "items": [
            {
                "id": "form_staz_erasmus",
                "label": "Erasmus+ praktická stáž",
                "path": "/auth/kc/kc.pl?formular=28;zalozka=novy;lang=cz",
                "keywords": ["zahraničí", "výjezd", "mobilita", "praxe"]
            },
            {
                "id": "form_staz_erasmus_mimo_eu",
                "label": "Erasmus+ stáž (mimo EU)",
                "path": "/auth/kc/kc.pl?formular=41;zalozka=novy;lang=cz",
                "keywords": ["zahraničí", "výjezd", "mobilita", "stipendium"]
            },
            {
                "id": "form_la_schvaleni",
                "label": "Schválení Learning Agreement",
                "path": "/auth/kc/kc.pl?formular=106;zalozka=novy;lang=cz",
                "keywords": ["erasmus", "smlouva", "předměty", "zahraničí", "LA"]
            },
            {
                "id": "form_la_zmeny",
                "label": "Změny Learning Agreement",
                "path": "/auth/kc/kc.pl?formular=107;zalozka=novy;lang=cz",
                "keywords": ["erasmus", "during mobility", "změna předmětů"]
            },
            {
                "id": "form_uznani_vyjezd",
                "label": "Uznání předmětů z výjezdu",
                "path": "/auth/kc/kc.pl?formular=108;zalozka=novy;lang=cz",
                "keywords": ["erasmus", "návrat", "zahraničí", "kredity"]
            }
        ]
    },
    {
        "id": "cat_microsoft",
        "label": "Microsoft 365",
        "items": [
            {
                "id": "teams",
                "label": "Teams",
                "path": "https://teams.microsoft.com",
                "keywords": ["chat", "videohovory", "schůzky", "komunikace", "kolaborace"]
            },
            {
                "id": "outlook",
                "label": "Outlook",
                "path": "https://outlook.office.com",
                "keywords": ["email", "pošta", "kalendář", "schůzky"]
            }
        ]
    }
];

export const BASE_URL = "https://is.mendelu.cz";
