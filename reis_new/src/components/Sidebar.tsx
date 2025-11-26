import { useState, useRef } from 'react';
import {
  Home,
  User,
  GraduationCap,
  Settings,
  ChevronRight,
  BookOpen,
  Award,
  BookMarked,
  ClipboardList,
  Wifi,
  ClipboardCheck,
  FileQuestion,
  LayoutGrid,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MENDELU_LOGO_PATH } from '../constants/icons';
import { useUserParams } from '../hooks/useUserParams';
import { Switch } from './ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { SyncService } from '../services/sync_service';
import { GoogleDriveService } from '../services/google_drive';
import { DriveSetupWizard } from './DriveSetupWizard';
import { useEffect } from 'react';


interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  expandable?: boolean;
  children?: { label: string; id: string; icon?: React.ReactNode; href?: string }[];
  danger?: boolean;
  onClick?: () => void;
  href?: string;
}

export const Sidebar = () => {
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const { params } = useUserParams();
  const studiumId = params?.studium || '';
  const obdobiId = params?.obdobi || '';

  const [driveEnabled, setDriveEnabled] = useState(false);
  const [showDriveWizard, setShowDriveWizard] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useEffect(() => {
    checkDriveStatus();
  }, []);

  const checkDriveStatus = async () => {
    const settings = await SyncService.getInstance().getSettings();
    setDriveEnabled(settings.isAuthorized);
  };

  const handleDriveToggle = (checked: boolean) => {
    if (checked) {
      setShowDriveWizard(true);
    } else {
      setShowDisconnectConfirm(true);
    }
  };

  const handleDisconnect = async () => {
    await GoogleDriveService.getInstance().signOut();
    await SyncService.getInstance().clearSettings();
    setDriveEnabled(false);
    setShowDisconnectConfirm(false);
  };

  // Menu configuration
  const mainMenuItems: MenuItem[] = [
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
          href: 'https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167;lang=cz'
        },
        {
          id: 'studijni-plany',
          label: 'Studijní plány',
          icon: <BookMarked className="w-4 h-4" />,
          href: 'https://is.mendelu.cz/auth/katalog/plany.pl?lang=cz'
        },
        {
          id: 'wifi',
          label: 'Nastavení Wi-Fi',
          icon: <Wifi className="w-4 h-4" />,
          href: 'https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang=cz'
        },
        {
          id: 'zadosti-formular',
          label: 'Žádosti a formuláře',
          icon: <ClipboardList className="w-4 h-4" />,
          href: 'https://is.mendelu.cz/auth/kc/kc.pl?_m=17022;lang=cz'
        }
      ]
    }
  ];

  const handleMouseEnter = (itemId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredItem(itemId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 300);
  };

  const handleItemClick = (item: MenuItem) => {
    setActiveItem(item.id);
    if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-22 h-screen bg-gray-50 border-r border-gray-200 fixed left-0 top-0 z-40 items-center py-6">
        {/* Logo */}
        <div className="mb-8 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden">
          <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col w-full px-2 gap-2">
          {mainMenuItems.map((item) => (
            <div
              key={item.id}
              className="relative group"
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleItemClick(item)}
                className={`w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
                                    ${activeItem === item.id
                    ? 'bg-[#79be15]/10 text-[#79be15] shadow-sm'
                    : 'text-gray-400 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                  }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight">
                  {item.label}
                </span>
              </button>

              {/* Popup Menu */}
              <AnimatePresence>
                {hoveredItem === item.id && item.expandable && (
                  <motion.div
                    initial={{ opacity: 0, x: 10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute left-14 top-0 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50"
                    style={{ top: '-1rem' }}
                  >
                    <div className="px-3 py-2 border-b border-gray-50 mb-1">
                      <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {item.children?.map((child) => (
                        <a
                          key={child.id}
                          href={child.href}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary transition-colors group/item"
                        >
                          <span className="text-gray-400 group-hover/item:text-primary transition-colors">
                            {child.icon || <ChevronRight className="w-4 h-4" />}
                          </span>
                          {child.label}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 px-2 w-full mt-auto">
          <a href="https://teams.microsoft.com" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-white hover:text-[#5059C9] hover:shadow-sm transition-all mx-auto group">
            <LayoutGrid className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Teams</span>
          </a>
          <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-white hover:text-[#0078D4] hover:shadow-sm transition-all mx-auto group">
            <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Outlook</span>
          </a>
          <div
            className="relative group"
            onMouseEnter={() => handleMouseEnter('profile')}
            onMouseLeave={handleMouseLeave}
          >
            <button className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-all mx-auto">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">Profil</span>
            </button>

            <AnimatePresence>
              {hoveredItem === 'profile' && (
                <motion.div
                  initial={{ opacity: 0, x: 10, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.95 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute left-14 bottom-0 w-72 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-50"
                  style={{ bottom: '0' }}
                >
                  <div className="px-1 py-1 border-b border-gray-50 mb-3">
                    <h3 className="font-semibold text-gray-900">Nastavení profilu</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Outlook Sync */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Outlook kalendář</div>
                        <div className="text-xs text-gray-400">Synchronizace rozvrhu</div>
                      </div>
                      <Switch disabled checked={false} />
                    </div>

                    {/* Google Drive Sync */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-700">Google Drive</div>
                        <div className="text-xs text-gray-400">Záloha materiálů</div>
                      </div>
                      <Switch
                        checked={driveEnabled}
                        onCheckedChange={handleDriveToggle}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Drive Setup Wizard */}
      {showDriveWizard && (
        <DriveSetupWizard
          onComplete={() => {
            setShowDriveWizard(false);
            checkDriveStatus();
          }}
          onClose={() => setShowDriveWizard(false)}
        />
      )}

      {/* Disconnect Confirmation */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odpojit Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              Tímto zastavíte automatickou synchronizaci souborů. Vaše již nahrané soubory na Disku zůstanou zachovány.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-red-600 hover:bg-red-700">
              Odpojit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};