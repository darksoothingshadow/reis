import { getStudiumSync } from '../utils/userParams';

// Pages data for search functionality
export interface PageItem {
    id: string;
    label: string;
    href: string;
}

export interface PageCategory {
    id: string;
    label: string;
    icon?: string;
    expandable?: boolean;
    children: PageItem[];
}

/**
 * Inject user's studium into a page URL.
 * Replaces the placeholder studium with the current user's actual ID.
 */
export function injectUserParams(url: string): string {
    const studium = getStudiumSync();
    if (!studium) {
        // Remove studium param entirely if we don't have one
        return url
            .replace(/studium=\d+[;,&]?/g, '')
            .replace(/[;,&]?studium=\d+/g, '');
    }
    // Replace any existing studium with the user's value
    return url.replace(/studium=\d+/g, `studium=${studium}`);
}

export const pagesData: PageCategory[] = [
    {
        "id": "portal-info",
        "label": "Portál veřejných informací",
        "icon": "Info",
        "expandable": true,
        "children": [
            {
                "id": "katalog-predmetu",
                "label": "Katalog předmětů",
                "href": "https://is.mendelu.cz/auth/katalog/?_m=111;lang=cz"
            },
            {
                "id": "lide",
                "label": "Lidé na MENDELU",
                "href": "https://is.mendelu.cz/auth/lide/?_m=104;lang=cz"
            },
            {
                "id": "rozvrhy",
                "label": "Rozvrhy",
                "href": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl?_m=117;lang=cz"
            },
            {
                "id": "dalsi-info",
                "label": "Další informace o MENDELU",
                "href": "https://is.mendelu.cz/auth/verejne_informace.pl?_m=8301;lang=cz"
            },
            {
                "id": "tematicke-vyhledavani",
                "label": "Tematické vyhledávání",
                "href": "https://is.mendelu.cz/auth/hledani/?_m=8311;lang=cz"
            },
            {
                "id": "studijni-plany",
                "label": "Studijní plány",
                "href": "https://is.mendelu.cz/auth/katalog/plany.pl?_m=113;lang=cz"
            },
            {
                "id": "pracoviste",
                "label": "Pracoviště",
                "href": "https://is.mendelu.cz/auth/pracoviste/pracoviste.pl?_m=8312;lang=cz"
            },
            {
                "id": "zaverecne-prace",
                "label": "Závěrečné práce na MENDELU",
                "href": "https://is.mendelu.cz/auth/zp/?_m=20841;lang=cz"
            },
            {
                "id": "absolventi",
                "label": "Absolventi",
                "href": "https://is.mendelu.cz/auth/lide/absolventi.pl?_m=23002;lang=cz"
            }
        ]
    },
    {
        "id": "moje-studium",
        "label": "Moje studium",
        "icon": "GraduationCap",
        "expandable": true,
        "children": [
            {
                "id": "portal-studenta",
                "label": "Portál studenta",
                "href": "https://is.mendelu.cz/auth/student/moje_studium.pl?lang=cz"
            },
            {
                "id": "e-index",
                "label": "E-index",
                "href": "https://is.mendelu.cz/auth/student/pruchod_studiem.pl?studium=149707;lang=cz"
            },
            {
                "id": "moji-spoluzaci",
                "label": "Moji spolužáci",
                "href": "https://is.mendelu.cz/auth/student/spoluzaci.pl?studium=149707;lang=cz"
            },
            {
                "id": "informace-o-studiu",
                "label": "Informace o mém studiu",
                "href": "https://is.mendelu.cz/auth/student/studium.pl?studium=149707;lang=cz"
            },
            {
                "id": "mapa-studii",
                "label": "Mapa mých studií",
                "href": "https://is.mendelu.cz/auth/student/mapa_studii.pl?studium=149707;lang=cz"
            },
            {
                "id": "e-osnovy",
                "label": "E-osnovy předmětů",
                "href": "https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=149707;lang=cz"
            },
            {
                "id": "rozpisy-temat",
                "label": "Rozpisy témat",
                "href": "https://is.mendelu.cz/auth/student/temata_prihlasovani.pl?studium=149707;lang=cz"
            },
            {
                "id": "odevzdavarny",
                "label": "Odevzdávárny",
                "href": "https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=149707;lang=cz"
            },
            {
                "id": "kontrola-planu",
                "label": "Kontrola plánu",
                "href": "https://is.mendelu.cz/auth/studijni/studijni_povinnosti.pl?studium=149707;lang=cz"
            },
            {
                "id": "list-zaznamnik",
                "label": "List záznamníku učitele",
                "href": "https://is.mendelu.cz/auth/student/list.pl?studium=149707;lang=cz"
            },
            {
                "id": "oblibene-predmety",
                "label": "Moje oblíbené předměty",
                "href": "https://is.mendelu.cz/auth/student/oblibene_predmety.pl?studium=149707;lang=cz"
            },
            {
                "id": "prihlasovani-zkouskam",
                "label": "Přihlašování na zkoušky",
                "href": "https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=149707;lang=cz"
            },
            {
                "id": "registrace-zapisy",
                "label": "Registrace, zápisy a změny po zápisech",
                "href": "https://is.mendelu.cz/auth/student/registrace.pl?studium=149707;lang=cz"
            },
            {
                "id": "tema-zp",
                "label": "Téma závěrečné práce",
                "href": "https://is.mendelu.cz/auth/student/zp_temata.pl?studium=149707;lang=cz"
            },
            {
                "id": "osobni-rozvrh",
                "label": "Osobní rozvrh",
                "href": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl?rozvrh_student_obec=1?zobraz=1;format=html;rozvrh_student=PLACEHOLDER;zpet=../student/moje_studium.pl?lang=cz,studium=149707,lang=cz"
            },
            {
                "id": "harmonogram-vyuky",
                "label": "Harmonogram výuky (přehled týdnů)",
                "href": "https://is.mendelu.cz/auth/ca/prehled_tydnu.pl?studium=149707;lang=cz"
            },
            {
                "id": "harmonogram-ak-roku",
                "label": "Harmonogram akademického roku",
                "href": "https://is.mendelu.cz/auth/student/harmonogram.pl?fakulta=2;zpet_student=moje_studium.pl?lang=cz,studium=149707,;lang=cz"
            },
            {
                "id": "kontaktni-oddeleni",
                "label": "Kontaktní oddělení",
                "href": "https://is.mendelu.cz/auth/pracoviste/stud_odd.pl?fakulta=2;zpet_student=moje_studium.pl?lang=cz,studium=149707,lang=cz"
            },
            {
                "id": "statni-zkousky",
                "label": "Prohlídka státních zkoušek",
                "href": "https://is.mendelu.cz/auth/student/vysledky_sz.pl?studium=149707;lang=cz"
            },
            {
                "id": "kontaktni-centrum",
                "label": "Kontaktní centrum",
                "href": "https://is.mendelu.cz/auth/kc/kc.pl?studium=149707;lang=cz"
            },
            {
                "id": "moje-omluvenky",
                "label": "Moje omluvenky",
                "href": "https://is.mendelu.cz/auth/student/moje_omluvenky.pl?studium=149707;lang=cz"
            },
            {
                "id": "tisk-dokumentu",
                "label": "Tisk dokumentů",
                "href": "https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?studium=149707;lang=cz"
            },
            {
                "id": "uloziste-dokumentu-student",
                "label": "Úložiště dokumentů",
                "href": "https://is.mendelu.cz/auth/uloziste/index.pl?rezim=7;studium=149707;lang=cz"
            },
            {
                "id": "evaluace-predmetu",
                "label": "Evaluace předmětů studenty",
                "href": "https://is.mendelu.cz/auth/student/vyplneni_ankety.pl?studium=149707;lang=cz"
            },
            {
                "id": "pracovni-prilezitosti",
                "label": "Portál pracovních příležitostí",
                "href": "https://is.mendelu.cz/auth/praxe/index.pl?studium=149707;je_student=1;lang=cz"
            },
            {
                "id": "financovani-studia",
                "label": "Financování studia",
                "href": "https://is.mendelu.cz/auth/student/financovani.pl?studium=149707;lang=cz"
            },
            {
                "id": "ubytovaci-stipendium",
                "label": "Žádost o ubytovací stipendium",
                "href": "https://is.mendelu.cz/auth/student/zadost_ubyt_stip.pl?studium=149707;lang=cz"
            },
            {
                "id": "vyplacena-stipendia",
                "label": "Vyplacená stipendia",
                "href": "https://is.mendelu.cz/auth/student/vypl_stip_student.pl?studium=149707;lang=cz"
            },
            {
                "id": "bankovni-spojeni",
                "label": "Bankovní spojení",
                "href": "https://is.mendelu.cz/auth/student/bank_spojeni_clovek.pl?lang=cz"
            },
            {
                "id": "objednavky",
                "label": "Objednávky",
                "href": "https://is.mendelu.cz/auth/financovani/objednavky.pl?studium=149707;lang=cz"
            },
            {
                "id": "prihlasky-vymenny-pobyt",
                "label": "Podání přihlášky na výměnný pobyt",
                "href": "https://is.mendelu.cz/auth/int/podani_prihlasky.pl?studium=149707;lang=cz"
            },
            {
                "id": "hodnoceni-uspesnosti",
                "label": "Hodnocení úspěšnosti předmětů",
                "href": "https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167;lang=cz"
            },
            {
                "id": "prihlaska-ke-studiu",
                "label": "Přihláška ke studiu",
                "href": "https://is.mendelu.cz/auth/prihlaska/auth/evidence_eprihlasek.pl?_m=182;lang=cz"
            }
        ]
    },
    {
        "id": "veda-vyzkum",
        "label": "Věda a výzkum",
        "icon": "Microscope",
        "expandable": true,
        "children": [
            {
                "id": "parovani-publikaci",
                "label": "Párování publikací",
                "href": "https://is.mendelu.cz/auth/vv/parovani_publikaci.pl?_m=225;lang=cz"
            },
            {
                "id": "zivotopisne-udaje",
                "label": "Životopisné údaje",
                "href": "https://is.mendelu.cz/auth/vv/bio/?_m=219;lang=cz"
            },
            {
                "id": "tvorba-zivotopisu",
                "label": "Tvorba životopisů",
                "href": "https://is.mendelu.cz/auth/vv/bio/zivotopis.pl?_m=721;lang=cz"
            }
        ]
    },
    {
        "id": "elearning",
        "label": "eLearning",
        "icon": "Monitor",
        "expandable": true,
        "children": [
            {
                "id": "testy-zkouseni",
                "label": "Testy a zkoušení",
                "href": "https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=cz"
            },
            {
                "id": "eknihovajna",
                "label": "Elektronické studijní materiály",
                "href": "https://is.mendelu.cz/auth/eknihovna/?_m=206;lang=cz"
            }
        ]
    },
    {
        "id": "osobni-management",
        "label": "Osobní management",
        "icon": "User",
        "expandable": true,
        "children": [
            {
                "id": "dokumentovy-server",
                "label": "Dokumentový server",
                "href": "https://is.mendelu.cz/auth/dok_server/?_m=229;lang=cz"
            },
            {
                "id": "postovni-schranka",
                "label": "Poštovní schránka",
                "href": "https://is.mendelu.cz/auth/posta/slozka.pl?_m=228;lang=cz"
            },
            {
                "id": "diskuzni-fora",
                "label": "Diskuzní fóra",
                "href": "https://is.mendelu.cz/auth/diskuze/?_m=2720;lang=cz"
            },
            {
                "id": "uloziste-dokumentu",
                "label": "Úložiště dokumentů",
                "href": "https://is.mendelu.cz/auth/uloziste/index.pl?rezim=2;_m=16924;lang=cz"
            },
            {
                "id": "odber-novinek",
                "label": "Odběr novinek",
                "href": "https://is.mendelu.cz/auth/posta/novinky.pl?_m=7937;lang=cz"
            },
            {
                "id": "vyveska",
                "label": "Vývěska",
                "href": "https://is.mendelu.cz/auth/vyveska/index.pl?_m=4696;lang=cz"
            },
            {
                "id": "ukoly",
                "label": "Úkoly",
                "href": "https://is.mendelu.cz/auth/todo/?_m=230;lang=cz"
            },
            {
                "id": "knihovna-vypujcky",
                "label": "Výpůjčky ve školní knihovně",
                "href": "https://is.mendelu.cz/auth/pim/knihovna_vypujcky.pl?_m=239;lang=cz"
            }
        ]
    },
    {
        "id": "eagenda",
        "label": "eAgenda",
        "icon": "Briefcase",
        "expandable": true,
        "children": [
            {
                "id": "kontaktni-centrum",
                "label": "Kontaktní centrum",
                "href": "https://is.mendelu.cz/auth/kc/kc.pl?_m=17022;lang=cz"
            },
            {
                "id": "kolejni-administrativa",
                "label": "Kolejní administrativa",
                "href": "https://is.mendelu.cz/auth/uskm/koleje_index.pl?_m=308;lang=cz"
            },
            {
                "id": "zahranicni-cesty",
                "label": "Zahraniční cesty",
                "href": "https://is.mendelu.cz/auth/int/zahranicni_cesty.pl?_m=14094;lang=cz"
            },
            {
                "id": "epruzkumy",
                "label": "ePrůzkumy",
                "href": "https://is.mendelu.cz/auth/vv/epruzkumy/prehled_pruzkumu.pl?_m=2969;lang=cz"
            },
            {
                "id": "portal-volice",
                "label": "Portál voliče",
                "href": "https://is.mendelu.cz/auth/evolby/portal_volice.pl?_m=23942;lang=cz"
            },
            {
                "id": "evidence-tisku",
                "label": "Evidence tisků",
                "href": "https://is.mendelu.cz/auth/tisk/evidence_tisku.pl?_m=26181;lang=cz"
            }
        ]
    },
    {
        "id": "technologie",
        "label": "Technologie a jejich správa",
        "icon": "Settings",
        "expandable": true,
        "children": [
            {
                "id": "wifi-certifikat",
                "label": "Certifikát bezdrátové sítě (eduroam)",
                "href": "https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang=cz"
            },
            {
                "id": "sprava-uctu",
                "label": "Správa účtů",
                "href": "https://is.mendelu.cz/auth/ca/ucet.pl?_m=176;lang=cz"
            },
            {
                "id": "pristupovy-system",
                "label": "Přístupový systém",
                "href": "https://is.mendelu.cz/auth/ps/?_m=175;lang=cz"
            },
            {
                "id": "pristup-vpn",
                "label": "Přístup do univerzitní sítě",
                "href": "https://is.mendelu.cz/auth/wifi/heslo_vpn_sit.pl?_m=3532;lang=cz"
            },
            {
                "id": "statistiky-wifi",
                "label": "Statistiky bezdrátové a kolejní sítě",
                "href": "https://is.mendelu.cz/auth/wifi/statistika.pl?_m=21201;lang=cz"
            },
            {
                "id": "univ-posta",
                "label": "Doručování univerzitní pošty",
                "href": "https://is.mendelu.cz/auth/sit/univ_posta.pl?_m=312;lang=cz"
            },
            {
                "id": "prehled-techniky",
                "label": "Přehled evidované techniky",
                "href": "https://is.mendelu.cz/auth/sit/technika_moje.pl?_m=313;lang=cz"
            },
            {
                "id": "ms-imagine",
                "label": "Přihláška do Microsoft Imagine",
                "href": "https://is.mendelu.cz/auth/student/nastaveni_dreamspark.pl?_m=4003;lang=cz"
            }
        ]
    },
    {
        "id": "sprava-is",
        "label": "Správa informačního systému",
        "icon": "Database",
        "expandable": true,
        "children": [
            {
                "id": "mobilni-aplikace",
                "label": "Správa pověření externích aplikací",
                "href": "https://is.mendelu.cz/auth/system/mobilni_aplikace.pl?_m=24081;lang=cz"
            }
        ]
    },
    {
        "id": "dokumentace",
        "label": "Dokumentace UIS",
        "icon": "BookOpen",
        "expandable": true,
        "children": [
            {
                "id": "dokumentace-uis",
                "label": "Dokumentace UIS",
                "href": "https://is.mendelu.cz/auth/dok/help.pl?_m=21421;lang=cz"
            },
            {
                "id": "faq",
                "label": "Často kladené otázky",
                "href": "https://is.mendelu.cz/auth/dok/faq.pl?_m=255;lang=cz"
            },
            {
                "id": "licence",
                "label": "Licenční informace",
                "href": "https://is.mendelu.cz/auth/about/?_m=256;lang=cz"
            },
            {
                "id": "statistiky-uis",
                "label": "Statistiky využití UIS",
                "href": "https://is.mendelu.cz/auth/system/agregat.pl?_m=267;lang=cz"
            },
            {
                "id": "moje-operace",
                "label": "Mé operace",
                "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=286;lang=cz"
            },
            {
                "id": "integratori",
                "label": "Systémoví integrátoři",
                "href": "https://is.mendelu.cz/auth/dok/integratori.pl?_m=264;lang=cz"
            }
        ]
    },
    {
        "id": "herna",
        "label": "Herna pro chvíle oddechu",
        "icon": "Gamepad2",
        "expandable": true,
        "children": [
            {
                "id": "housenka",
                "label": "Housenka",
                "href": "https://is.mendelu.cz/auth/herna/housenka.pl?_m=4154;lang=cz"
            },
            {
                "id": "prehled-her",
                "label": "Přehled her a statistiky",
                "href": "https://is.mendelu.cz/auth/herna/index.pl?_m=4155;lang=cz"
            },
            {
                "id": "iq-soliter",
                "label": "IQ Solitér",
                "href": "https://is.mendelu.cz/auth/herna/soliter.pl?_m=4144;lang=cz"
            },
            {
                "id": "kamenozrout",
                "label": "Kamenožrout",
                "href": "https://is.mendelu.cz/auth/herna/kamenozrout.pl?_m=4152;lang=cz"
            }
        ]
    },
    {
        "id": "personalizace",
        "label": "Přizpůsobení informačního systému",
        "icon": "Palette",
        "expandable": true,
        "children": [
            {
                "id": "portlety",
                "label": "Portlety v UIS",
                "href": "https://is.mendelu.cz/auth/personalizace/portlety.pl?_m=354;lang=cz"
            },
            {
                "id": "oblibene",
                "label": "Údržba nabídky Moje oblíbené",
                "href": "https://is.mendelu.cz/auth/personalizace/menu_user.pl?_m=362;lang=cz"
            },
            {
                "id": "office365",
                "label": "Konfigurace přenosu událostí do Office 365",
                "href": "https://is.mendelu.cz/auth/ca/konfigurace_prenosu_udalosti.pl?_m=20781;lang=cz"
            },
            {
                "id": "uziv-nastaveni",
                "label": "Uživatelská nastavení",
                "href": "https://is.mendelu.cz/auth/personalizace/pref.pl?_m=356;lang=cz"
            }
        ]
    },
    {
        "id": "nastaveni-is",
        "label": "Nastavení informačního systému",
        "icon": "Cog",
        "expandable": true,
        "children": [
            {
                "id": "totp",
                "label": "Nastavení autentizace pomocí jednorázových hesel (OTP)",
                "href": "https://is.mendelu.cz/auth/system/nastaveni_totp.pl?_m=23141;lang=cz"
            },
            {
                "id": "identita-obcana",
                "label": "Propojení účtu s Identitou občana",
                "href": "https://is.mendelu.cz/auth/system/nia.pl?_m=25361;lang=cz"
            },
            {
                "id": "moje-operace-2",
                "label": "Mé operace",
                "href": "https://is.mendelu.cz/auth/system/zobraz_wlog.pl?current=1;_m=275;lang=cz"
            },
            {
                "id": "zmena-identity",
                "label": "Změna identity",
                "href": "https://is.mendelu.cz/auth/system/zmena_identity.pl?_m=287;lang=cz"
            },
            {
                "id": "delegati",
                "label": "Nastavení delegátů",
                "href": "https://is.mendelu.cz/auth/system/nastaveni_delegatu.pl?_m=288;lang=cz"
            },
            {
                "id": "obnova-hesla",
                "label": "Bezpečnostní údaje pro obnovení hesla",
                "href": "https://is.mendelu.cz/auth/system/hesla_nastaveni.pl?_m=20921;lang=cz"
            },
            {
                "id": "zmena-hesla",
                "label": "Změna hesla",
                "href": "https://is.mendelu.cz/auth/system/zmena_hesla.pl?_m=289;lang=cz"
            },
            {
                "id": "odhlaseni",
                "label": "Odhlášení",
                "href": "https://is.mendelu.cz/auth/system/logout.pl?_m=291;lang=cz"
            }
        ]
    },
    {
        "id": "ochrana-udaju",
        "label": "Ochrana osobních údajů",
        "icon": "Shield",
        "expandable": true,
        "children": [
            {
                "id": "kontrola-udaju",
                "label": "Kontrola osobních údajů",
                "href": "https://is.mendelu.cz/auth/kontrola/?_m=22841;lang=cz"
            },
            {
                "id": "souhlasy",
                "label": "Souhlasy uživatele",
                "href": "https://is.mendelu.cz/auth/system/oou_uziv.pl?_m=22848;lang=cz"
            },
            {
                "id": "statistika-kontroly",
                "label": "Statistika potvrzení o kontrole",
                "href": "https://is.mendelu.cz/auth/kontrola/statistika.pl?_m=22844;lang=cz"
            }
        ]
    }
];

export const BASE_URL = "https://is.mendelu.cz";
