import {
  Home,
  Book,
  CalendarCheck,
  LayoutDashboard,
  ClipboardList,
  PenTool,
  User,
  Wifi,
  Map,
  FileText,
} from 'lucide-react';
import type { MenuItem } from '../menuConfig';

export const mainItems = (
  sid: string,
  oid: string,
  t: (key: string) => string,
  lang: string = 'cz'
): MenuItem[] => [
  {
    id: 'dashboard',
    label: t('sidebar.dashboard'),
    icon: <Home className="w-5 h-5" />,
    href: `https://is.mendelu.cz/auth/?lang=${lang}`,
  },
  { id: 'exams', label: t('sidebar.exams'), icon: <CalendarCheck className="w-5 h-5" /> },
  { id: 'subjects', label: t('sidebar.subjects'), icon: <Book className="w-5 h-5" /> },
  { id: 'map', label: t('sidebar.map'), icon: <Map className="w-5 h-5" /> },
  {
    id: 'is',
    label: t('sidebar.is'),
    icon: <User className="w-5 h-5" />,
    expandable: true,
    children: [
      {
        id: 'dokumenty',
        label: t('sidebar.documents'),
        icon: <FileText className="w-4 h-4" />,
        isFeature: true,
      },
      {
        id: 'eduroam',
        label: t('sidebar.eduroam'),
        icon: <Wifi className="w-4 h-4" />,
        isFeature: true,
      },
      {
        id: 'portal-studenta',
        label: t('sidebar.portal'),
        icon: <LayoutDashboard className="w-4 h-4" />,
        href: `https://is.mendelu.cz/auth/student/moje_studium.pl?lang=${lang}`,
      },
      {
        id: 'zaznamniky',
        label: t('sidebar.notebooks'),
        icon: <ClipboardList className="w-4 h-4" />,
        href: `https://is.mendelu.cz/auth/student/list.pl?studium=${sid};obdobi=${oid};lang=${lang}`,
      },
      {
        id: 'testy',
        label: t('sidebar.tests'),
        icon: <PenTool className="w-4 h-4" />,
        href: `https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?_m=205;lang=${lang}`,
      },
    ],
  },
];
