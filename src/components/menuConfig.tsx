import {
    Home,
    User,
    GraduationCap,
    Settings,
    LogOut,
    BookOpen,
    Award,
    BookMarked,
    ClipboardList,
    Wifi,
    ClipboardCheck,
    FileQuestion
} from 'lucide-react';

export interface MenuItem {
    id: string;
    label: string;
    shortLabel?: string; // For sidebar icon view
    popupLabel?: string; // For popup header
    icon: React.ReactNode;
    expandable?: boolean;
    children?: { label: string; id: string; icon?: React.ReactNode; href?: string }[];
    danger?: boolean;
    onClick?: () => void;
    href?: string;
}

export const getMainMenuItems = (studiumId: string = '', obdobiId: string = ''): MenuItem[] => [
    {
        id: 'dashboard',
        label: 'Domů',
        icon: <Home className="w-5 h-5" />,
        href: 'https://is.mendelu.cz/auth/'
    },
    {
        id: 'portal',
        label: 'Student',
        icon: <User className="w-5 h-5" />,
        expandable: true,
        children: [
            {
                id: 'testy',
                label: 'Testy',
                icon: <FileQuestion className="w-4 h-4" />,
                href: 'https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=cz'
            },
            {
                id: 'zkousky',
                label: 'Zkoušky',
                icon: <ClipboardCheck className="w-4 h-4" />,
                href: `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${studiumId};obdobi=${obdobiId};lang=cz`
            },
            {
                id: 'cvicne-testy',
                label: 'Cvičné testy',
                icon: <FileQuestion className="w-4 h-4" />,
                href: `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${studiumId};obdobi=${obdobiId};lang=cz`
            },
            {
                id: 'zapisy-predmetu',
                label: 'Zápisy předmětů',
                icon: <BookOpen className="w-4 h-4" />,
                href: `https://is.mendelu.cz/auth/student/registrace.pl?studium=${studiumId};obdobi=${obdobiId};lang=cz`
            }
        ]
    },
    {
        id: 'o-studiu',
        label: 'Studium',
        icon: <GraduationCap className="w-5 h-5" />,
        expandable: true,
        children: [
            {
                id: 'hodnoceni-uspesnosti',
                label: 'Hodnocení úspěšnosti předmětů',
                icon: <Award className="w-4 h-4" />,
                href: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167'
            },
            {
                id: 'studijni-plany',
                label: 'Studijní plány',
                icon: <BookMarked className="w-4 h-4" />,
                href: 'https://is.mendelu.cz/auth/katalog/plany.pl'
            },
            {
                id: 'wifi',
                label: 'Nastavení Wi-Fi',
                icon: <Wifi className="w-4 h-4" />,
                href: 'https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177'
            },
            {
                id: 'zadosti-formular',
                label: 'Žádosti a formuláře',
                icon: <ClipboardList className="w-4 h-4" />,
                href: 'https://is.mendelu.cz/auth/kc/kc.pl?_m=17022'
            }
        ]
    }
];

export const getSettingsMenuItems = (handleLogout: () => void): MenuItem[] => [
    {
        id: 'nastaveni',
        label: 'Nastavení',
        icon: <Settings className="w-5 h-5" />,
        // href: '/settings' // Placeholder if we had a settings page
    },
    {
        id: 'odhlaseni',
        label: 'Odhlášení',
        icon: <LogOut className="w-5 h-5" />,
        danger: true,
        onClick: handleLogout
    }
];
