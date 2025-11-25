import { useState } from 'react';
import { GoogleDriveService } from '../services/google_drive';
import { SyncService } from '../services/sync_service';
import { DRIVE_CONSTANTS } from '../constants/drive';
import { Cloud, Check, Loader2, AlertCircle, X } from 'lucide-react';

interface DriveSetupWizardProps {
    onComplete: () => void;
    onClose: () => void;
}

export function DriveSetupWizard({ onComplete, onClose }: DriveSetupWizardProps) {
    const [step, setStep] = useState<'intro' | 'folder' | 'loading' | 'success'>('intro');
    const [folderMode, setFolderMode] = useState<'auto' | 'custom'>('auto');
    const [customFolderId, setCustomFolderId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const driveService = GoogleDriveService.getInstance();
    const syncService = SyncService.getInstance();
    const DEFAULT_FOLDER_NAME = DRIVE_CONSTANTS.DEFAULT_FOLDER_NAME;

    const handleStartSetup = () => {
        setStep('folder');
        setError(null);
    };

    const handleConnect = async () => {
        setStep('loading');
        setError(null);
        try {
            // 1. Authenticate
            await driveService.authenticate();

            let folderId: string;
            let folderName: string;

            if (folderMode === 'custom') {
                // Validate custom folder ID
                const isValid = await driveService.validateFolderId(customFolderId.trim());
                if (!isValid) {
                    setError('Neplatné ID složky. Zkontrolujte prosím a zkuste to znovu.');
                    setStep('folder');
                    return;
                }
                folderId = customFolderId.trim();
                folderName = 'Custom Folder'; // Name doesn't matter for custom
            } else {
                // Auto-create default folder
                let folder = await driveService.searchFolder(DEFAULT_FOLDER_NAME);
                if (!folder) {
                    folder = await driveService.createFolder(DEFAULT_FOLDER_NAME);
                }
                folderId = folder.id;
                folderName = folder.name;
            }

            // 3. Save Settings
            await syncService.saveSettings({
                isAuthorized: true,
                rootFolderId: folderId,
                rootFolderName: folderName
            });

            setStep('success');

            // Auto-close after delay
            setTimeout(() => {
                onComplete();
            }, 1500);

        } catch (e) {
            console.error(e);
            setError("Nepodařilo se propojit s Google Drive. Zkuste to prosím znovu.");
            setStep('folder');
        }
    };

    if (step === 'success') {
        return (
            <div className="fixed z-[1000] inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm font-dm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center space-y-4 transform scale-100 transition-all">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2 animate-bounce">
                        <Check size={32} className="text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">Propojeno!</h3>
                    <p className="text-gray-500">Vaše materiály se nyní budou automaticky zálohovat.</p>
                </div>
            </div>
        );
    }

    // Loading state
    if (step === 'loading') {
        return (
            <div className="fixed z-[1000] inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm font-dm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center space-y-4">
                    <Loader2 size={48} className="animate-spin text-[#8DC843]" />
                    <p className="text-gray-600">Propojování...</p>
                </div>
            </div>
        );
    }

    // Folder selection step
    if (step === 'folder') {
        return (
            <div className="fixed z-[1000] inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm font-dm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-8 space-y-6">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-bold text-gray-900">Kde uložit soubory?</h2>
                            <p className="text-gray-500">Vyberte, kam chcete zálohovat své studijní materiály.</p>
                        </div>

                        {error && (
                            <div className="w-full p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50"
                                style={{ borderColor: folderMode === 'auto' ? '#8DC843' : '#e5e7eb' }}>
                                <input
                                    type="radio"
                                    name="folderMode"
                                    checked={folderMode === 'auto'}
                                    onChange={() => setFolderMode('auto')}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-900">Vytvořit novou složku (Doporučeno)</div>
                                    <div className="text-sm text-gray-500 mt-1">Vytvoří se "{DEFAULT_FOLDER_NAME}" v kořenu Disku</div>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:bg-gray-50"
                                style={{ borderColor: folderMode === 'custom' ? '#8DC843' : '#e5e7eb' }}>
                                <input
                                    type="radio"
                                    name="folderMode"
                                    checked={folderMode === 'custom'}
                                    onChange={() => setFolderMode('custom')}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-900">Použít existující složku</div>
                                    <div className="text-sm text-gray-500 mt-1">Uložit do složky, kterou si vyberete</div>
                                </div>
                            </label>
                        </div>

                        {folderMode === 'custom' && (
                            <div className="space-y-2 pl-10">
                                <label className="text-sm font-medium text-gray-700">ID složky Google Drive</label>
                                <input
                                    type="text"
                                    value={customFolderId}
                                    onChange={(e) => setCustomFolderId(e.target.value)}
                                    placeholder="Vložte ID složky..."
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8DC843] focus:outline-none transition-colors"
                                />
                                <details className="text-xs text-gray-500">
                                    <summary className="cursor-pointer hover:text-gray-700">Jak získat ID složky?</summary>
                                    <ol className="mt-2 ml-4 space-y-1 list-decimal">
                                        <li>Otevřete Google Drive</li>
                                        <li>Přejděte do požadované složky</li>
                                        <li>Zkontrolujte URL: <code className="bg-gray-100 px-1 rounded">drive.google.com/drive/folders/XXXXX</code></li>
                                        <li>Zkopírujte část XXXXX</li>
                                    </ol>
                                </details>
                            </div>
                        )}

                        <button
                            onClick={handleConnect}
                            disabled={folderMode === 'custom' && !customFolderId.trim()}
                            className="w-full py-3.5 bg-[#8DC843] text-white rounded-xl font-semibold hover:bg-[#7db338] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Propojit účet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Intro step
    return (
        <div className="fixed z-[1000] inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm font-dm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                        <img
                            src={chrome.runtime.getURL("drive_icon.svg")}
                            alt="Google Drive"
                            className="w-10 h-10"
                        />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-gray-900">Propojit s Google Drive</h2>
                        <p className="text-gray-500 leading-relaxed">
                            Automaticky zálohujte své studijní materiály a mějte je přístupné odkudkoliv.
                        </p>
                    </div>

                    <button
                        onClick={handleStartSetup}
                        className="w-full py-3.5 bg-[#8DC843] text-white rounded-xl font-semibold text-lg hover:bg-[#7db338] active:scale-[0.98] transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-3"
                    >
                        <Cloud size={24} />
                        Začít
                    </button>

                    <p className="text-xs text-gray-400">
                        Soubory se budou automaticky synchronizovat každých 5 minut.
                    </p>
                </div>
            </div>
        </div>
    );
}
