import { useState, useEffect } from 'react';
import { GoogleDriveService } from '../services/google_drive';
import { Folder, ChevronRight, Loader2, Check, FolderPlus, ArrowLeft } from 'lucide-react';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
}

interface DriveFolderPickerProps {
    onSelect: (folderId: string, folderName: string) => void;
    onCancel: () => void;
    initialFolderId?: string;
}

export function DriveFolderPicker({ onSelect, onCancel, initialFolderId }: DriveFolderPickerProps) {
    const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolderId || 'root');
    const [folderStack, setFolderStack] = useState<{ id: string, name: string }[]>([{ id: 'root', name: 'Můj Disk' }]);
    const [folders, setFolders] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);

    const driveService = GoogleDriveService.getInstance();

    useEffect(() => {
        loadFolders(currentFolderId);
    }, [currentFolderId]);

    const loadFolders = async (folderId: string) => {
        setLoading(true);
        try {
            const files = await driveService.listFiles(folderId);
            // Filter only folders
            const folderList = files.filter(f => f.mimeType === 'application/vnd.google-apps.folder');
            // Sort by name
            folderList.sort((a, b) => a.name.localeCompare(b.name));
            setFolders(folderList);
        } catch (error) {
            console.error("Failed to load folders:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFolderClick = (folder: DriveFile) => {
        setFolderStack([...folderStack, { id: folder.id, name: folder.name }]);
        setCurrentFolderId(folder.id);
    };

    const handleBreadcrumbClick = (index: number) => {
        const newStack = folderStack.slice(0, index + 1);
        setFolderStack(newStack);
        setCurrentFolderId(newStack[newStack.length - 1].id);
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        setCreatingFolder(true);
        try {
            const newFolder = await driveService.createFolder(newFolderName, currentFolderId);
            setFolders(prev => [newFolder, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
            setNewFolderName('');
            setShowNewFolderInput(false);
            // Optionally auto-enter the new folder? No, just show it.
        } catch (error) {
            console.error("Failed to create folder:", error);
        } finally {
            setCreatingFolder(false);
        }
    };

    const getCurrentFolderName = () => {
        return folderStack[folderStack.length - 1].name;
    };

    return (
        <div className="fixed z-[1100] inset-0 flex justify-center items-center bg-black/50 backdrop-blur-sm font-dm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {folderStack.length > 1 && (
                            <button
                                onClick={() => handleBreadcrumbClick(folderStack.length - 2)}
                                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                        )}
                        <h3 className="font-semibold text-gray-800 truncate">
                            {getCurrentFolderName()}
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-700 px-3 py-1 text-sm font-medium"
                    >
                        Zrušit
                    </button>
                </div>

                {/* Breadcrumbs */}
                <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-1 text-sm text-gray-500 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {folderStack.map((folder, index) => (
                        <div key={folder.id} className="flex items-center">
                            {index > 0 && <ChevronRight size={14} className="mx-1 text-gray-400" />}
                            <button
                                onClick={() => handleBreadcrumbClick(index)}
                                className={`hover:text-[#8DC843] hover:underline transition-colors ${index === folderStack.length - 1 ? 'font-semibold text-gray-800' : ''}`}
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Folder List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 size={32} className="animate-spin text-[#8DC843]" />
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-full text-gray-400 gap-2">
                            <Folder size={48} className="opacity-20" />
                            <p>Žádné složky</p>
                        </div>
                    ) : (
                        folders.map(folder => (
                            <div
                                key={folder.id}
                                onClick={() => handleFolderClick(folder)}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer group transition-colors border border-transparent hover:border-gray-100"
                            >
                                <div className="p-2 bg-blue-50 text-blue-500 rounded-lg group-hover:bg-blue-100 transition-colors">
                                    <Folder size={20} />
                                </div>
                                <span className="flex-1 font-medium text-gray-700 truncate">{folder.name}</span>
                                <ChevronRight size={18} className="text-gray-300 group-hover:text-gray-400" />
                            </div>
                        ))
                    )}
                </div>

                {/* Footer / Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-3">
                    {/* New Folder Input */}
                    {showNewFolderInput ? (
                        <div className="flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Název nové složky"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#8DC843] text-sm"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                            <button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim() || creatingFolder}
                                className="px-3 py-2 bg-[#8DC843] text-white rounded-lg hover:bg-[#7db338] disabled:opacity-50"
                            >
                                {creatingFolder ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                            </button>
                            <button
                                onClick={() => setShowNewFolderInput(false)}
                                className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                            >
                                <ArrowLeft size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={() => setShowNewFolderInput(true)}
                                className="flex items-center gap-2 px-4 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
                            >
                                <FolderPlus size={18} />
                                Nová složka
                            </button>

                            <button
                                onClick={() => onSelect(currentFolderId, getCurrentFolderName())}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#8DC843] text-white rounded-xl hover:bg-[#7db338] active:scale-[0.98] transition-all shadow-sm font-medium"
                            >
                                <Check size={18} />
                                Vybrat tuto složku
                            </button>
                        </div>
                    )}
                    <div className="text-xs text-center text-gray-400">
                        Vybráno: <span className="font-medium text-gray-600">{getCurrentFolderName()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
