import { X } from 'lucide-react';
import type { CalendarSubject } from "../calendar/calendar";
import { GetIdFromLink } from "../helper";
import { getFilesFromId, getStoredSubject } from "../helper_ignore";
import type { FileObject, StoredSubject } from "../object_types";
import { useEffect, useState } from "react";
import { File } from 'lucide-react';
import { FileType } from 'lucide-react';
import { Map } from 'lucide-react';
import type { BlockLesson } from '../scheduele/scheduele';

export interface SubjectPopupProps{
    code:CalendarSubject,
    setter:React.Dispatch<React.SetStateAction<CalendarSubject | null>>,
}

export interface SubjectPopupPropsV2{
    code:BlockLesson,
    onClose:()=>void,
}

export function RenderSubFiles(props:{status:number|null}){
    switch(props.status){
        case null:
            return (
                <div className="w-full h-80 xl:h-150 flex justify-center items-center">
                    <span className="text-base xl:text-xl font-dm font-semibold text-gray-700">Chyba při načítání souborů</span>
                </div>
            )
        case 0:
            return (
                <div className="w-full h-80 xl:h-150 flex flex-col justify-center items-center">
                    <>
                        <style>
                            {`@keyframes rotation {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                            }`}
                        </style>
                        <span className='w-16 h-16'
                            style={{
                            border: "5px solid #8DC843",
                            borderBottomColor: "transparent",
                            borderRadius: "50%",
                            display: "inline-block",
                            boxSizing: "border-box",
                            animation: "rotation 1s linear infinite",
                            }}
                        ></span>
                    </>
                </div>
            )
        case 1:
            return (
                <div className="w-full h-80 xl:h-150 flex justify-center items-center">
                    <>
                        <style>
                            {`@keyframes rotation {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                            }`}
                        </style>
                        <span className='w-16 h-16'
                            style={{
                            border: "5px solid #8DC843",
                            borderBottomColor: "transparent",
                            borderRadius: "50%",
                            display: "inline-block",
                            boxSizing: "border-box",
                            animation: "rotation 1s linear infinite",
                            }}
                        ></span>
                    </>
                </div>
            )
        case 2:
            return (
                <div className="w-full h-80 xl:h-150 flex justify-center items-center">
                    <>
                        <style>
                            {`@keyframes rotation {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                            }`}
                        </style>
                        <span className='w-16 h-16'
                            style={{
                            border: "5px solid #8DC843",
                            borderBottomColor: "transparent",
                            borderRadius: "50%",
                            display: "inline-block",
                            boxSizing: "border-box",
                            animation: "rotation 1s linear infinite",
                            }}
                        ></span>
                    </>
                </div>
            )
    }
}

export function RenderEmptySubject(props:{code:string,setter:()=>void}){
    return (
        <div className="p-1 pl-4 pr-4 relative h-full w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center font-dm">
            <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.setter()}}>
                <X size={"2rem"}></X>
            </span>
            <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{`Předmět ${props.code} nenalezen v lokálním uložišti`}</span>
        </div>
    )
}

export function RenderLoading(props:{code:string,setter:()=>void}){
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            props.setter();
        }
    };
    
    return (
        <div className="fixed z-999 top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
            <div className="p-1 pl-4 pr-4 relative h-full w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center font-dm">
                <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.setter()}}>
                    <X size={"2rem"}></X>
                </span>
                <div className='w-full h-full flex items-center justify-center'>
                    <>
                        <style>
                            {`@keyframes rotation {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                            }`}
                        </style>
                        <span className='w-16 h-16'
                            style={{
                            border: "5px solid #8DC843",
                            borderBottomColor: "transparent",
                            borderRadius: "50%",
                            display: "inline-block",
                            boxSizing: "border-box",
                            animation: "rotation 1s linear infinite",
                            }}
                        ></span>
                    </>
                </div>
            </div>
        </div>
    )
}

export function SubjectPopup(props:SubjectPopupPropsV2){
    //FETCH SUBJECT FROM STORAGE
    const [subject_data,setSubjectData] = useState<StoredSubject|null>(null);
    const [files,setFiles] = useState<FileObject[]|null>(null);
    const [loadingfile,setLoadingFile] = useState<boolean>(false);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
    const [subfolderFilter, setSubfolderFilter] = useState<string>("all");
    //
    function parseName(name:string, hasComment: boolean = false){
        const MAX_LENGTH = hasComment ? 40 : 100; // kratší pro položky s komentářem, delší bez komentáře
        
        if(name.length > MAX_LENGTH){
            const name_deducted = name.substring(0, MAX_LENGTH-3);
            return name_deducted + "...";
        }
        return name;
    }
    //
    useEffect(()=>{
        (async()=>{
            const STORED_SUBJECT = await getStoredSubject(props.code.courseCode);
            setSubjectData(STORED_SUBJECT);
            if(STORED_SUBJECT == null){
                setFiles([]);
                setLoadingFiles(false);
                return;
            }
            
            // Try to load cached files first
            const cachedKey = `files_${props.code.courseCode}`;
            const cachedFiles = localStorage.getItem(cachedKey);
            if (cachedFiles) {
                try {
                    setFiles(JSON.parse(cachedFiles));
                } catch (e) {
                    console.error("Failed to parse cached files", e);
                }
            }
            
            // Fetch fresh files in background
            console.log(GetIdFromLink(STORED_SUBJECT.folderUrl),STORED_SUBJECT.folderUrl);
            const files = await getFilesFromId(GetIdFromLink(STORED_SUBJECT.folderUrl));
            setFiles(files);
            setLoadingFiles(false);
            
            // Cache for next time
            if (files && files.length > 0) {
                localStorage.setItem(cachedKey, JSON.stringify(files));
            }
        })();
    },[])
    //
    // Add ESC key listener to close popup
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                props.onClose();
            }
        };
        
        window.addEventListener('keydown', handleEscKey);
        
        // Cleanup listener when component unmounts
        return () => {
            window.removeEventListener('keydown', handleEscKey);
        };
    }, [props.onClose])
    //
    async function loadFile(link:string){
        setLoadingFile(true);
        try {
            const response = await fetch(`https://is.mendelu.cz/auth/dok_server/${link}`, {
                method: 'GET',
                credentials: 'include' // important if authentication cookies are needed
            });
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            // open in a new tab (browser PDF viewer)
            setLoadingFile(false);
            window.open(blobUrl, '_blank');  
        } catch (error) {
            setLoadingFile(false);
        }
        //
    };
    //
    function groupFilesByFolder(files: FileObject[]) {
        const grouped: { [folderId: string]: FileObject[] } = {};
        
        // Filter files by subfolder if a filter is active
        const filteredFiles = subfolderFilter === "all" 
            ? files 
            : files.filter(file => file.subfolder === subfolderFilter);
        
        filteredFiles.forEach(file => {
            const link = file.files[0]?.link || '';
            const match = link.match(/id=(\d+)/);
            const folderId = match ? match[1] : 'unknown';
            
            if (!grouped[folderId]) {
                grouped[folderId] = [];
            }
            grouped[folderId].push(file);
        });
        
        const sortedFolderIds = Object.keys(grouped).sort((a, b) => parseInt(a) - parseInt(b));
        
        // Flatten and sort files within each folder by comment number
        const sortedFiles: FileObject[] = [];
        sortedFolderIds.forEach(folderId => {
            const folderFiles = grouped[folderId].sort((a, b) => {
                // Extract numbers from file_comment (e.g., "Přednáška 3" -> 3)
                const numA = parseInt(a.file_comment.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.file_comment.match(/\d+/)?.[0] || '0');
                return numA - numB;
            });
            sortedFiles.push(...folderFiles);
        });
        
        return sortedFiles;
    }
    
    // Get unique subfolders for filter dropdown
    function getUniqueSubfolders(files: FileObject[]): string[] {
        const subfolders = new Set<string>();
        files.forEach(file => {
            if (file.subfolder && file.subfolder.trim() !== '') {
                subfolders.add(file.subfolder);
            }
        });
        return Array.from(subfolders).sort();
    }
    
    // Extract display name from subfolder (part after "/")
    function getSubfolderDisplayName(subfolder: string): string {
        const parts = subfolder.split('/');
        return parts.length > 1 ? parts[1].trim() : subfolder;
    }
    //
    // Handle click outside popup to close
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking on the backdrop itself, not on child elements
        if (e.target === e.currentTarget) {
            props.onClose();
        }
    };
    //
    // Show empty state if no subject data
    if(subject_data === null && !loadingFiles){
        return (
            <div className="fixed z-999 top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
                <div className="p-4 relative h-fit w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center font-dm">
                    <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={props.onClose}>
                        <X size={"2rem"}></X>
                    </span>
                    <span className="text-base xl:text-xl text-gray-700 py-8">{`Předmět ${props.code.courseCode} nenalezen`}</span>
                </div>
            </div>
        );
    }
    //
    return (
        <div className="fixed z-999 top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm p-8" onClick={handleBackdropClick}>
            {/*Window*/}
            {subject_data?
            <div className="p-1 pl-4 pr-4 relative h-full w-100 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center font-dm">
                <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.onClose()}}>
                    <X size={"2rem"}></X>
                </span>
                <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{subject_data.fullName}</span>
                <span className="w-full h-0.25 bg-gray-200 mb-2"></span>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                    <span className="text-base xl:text-xl text-gray-700 font-medium">Vyučující události</span>
                    <span className="text-base xl:text-lg text-gray-700">{props.code.teachers[0].shortName}</span>
                </div>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                    <span className="text-base xl:text-xl text-gray-700 font-medium">Místnost</span>
                    <span className="w-fit relative text-base xl:text-lg text-gray-700">
                        {props.code.room}
                        {/* Only rooms are 'Q' are currently supported in the widget with simple config */}
                        {props.code.room.startsWith('Q') && (
                            <Map 
                                className="absolute top-0 -right-1 h-full aspect-square text-primary translate-x-1/1 cursor-pointer hover:scale-110 transition-transform" 
                                onClick={()=>{window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${props.code.room}`,"_blank")}}
                            />
                        )}
                    </span>
                </div>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4 h-3/5">
                    <div className="flex flex-row justify-between items-center min-h-fit">
                        <span className="text-base xl:text-xl text-gray-700 font-medium">Dostupné soubory</span>
                        {typeof files !== "number" && files !== null && files.length > 0 && getUniqueSubfolders(files).length > 1 && (
                            <select 
                                value={subfolderFilter}
                                onChange={(e) => setSubfolderFilter(e.target.value)}
                                className="text-gray-900 text-sm px-2 py-1 border border-primary rounded bg-white cursor-pointer"
                            >
                                <option value="all">Vše</option>
                                {getUniqueSubfolders(files).map((subfolder) => (
                                    <option key={subfolder} value={subfolder}>
                                        {getSubfolderDisplayName(subfolder)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className='w-full flex flex-1 flex-col overflow-y-auto'>
                        {loadingFiles && (!files || files.length === 0) ? (
                            <div className="w-full h-32 flex justify-center items-center">
                                <span className="text-sm text-gray-500">Načítání souborů...</span>
                            </div>
                        ) : files === null || files.length === 0 ? (
                            <div className="w-full h-32 flex justify-center items-center">
                                <span className="text-sm text-gray-500">Žádné soubory nejsou dostupné</span>
                            </div>
                        ) : loadingfile ? (
                            <div className="w-full h-32 flex justify-center items-center">
                                <span className="text-sm text-gray-500">Otevírání souboru...</span>
                            </div>
                        ) : (
                            groupFilesByFolder(files).map((data, i) =>
                                data.files.map((_, l) => (
                                    <div key={`${i}-${l}`} className="relative w-full min-h-10 flex flex-row items-center text-xs xl:text-base gap-2">
                                    <div className="aspect-square flex-none flex justify-center items-center">
                                        <File />
                                    </div>
                                    <span
                                        className={`text-gray-700 pl-2 pr-2 hover:text-primary cursor-pointer ${data.file_comment ? 'w-80' : 'w-full'}`}
                                        onClick={() => loadFile(_.link)}
                                    >
                                        {data.files.length === 1 ? 
                                            parseName(data.file_name, !!data.file_comment) : 
                                            parseName(data.file_name + ": část " + (l + 1), !!data.file_comment)}
                                    </span>
                                    {data.file_comment && (
                                        <>
                                            <div className="aspect-square h-full flex justify-center items-center">
                                                <FileType />
                                            </div>
                                            <span className="text-gray-400 ml-2">{data.file_comment}</span>
                                        </>
                                    )}
                                    {/* <span className="text-gray-400 ml-2">{data.author}</span> */}
                                    </div>
                                ))
                            )
                            )}
                    </div>
                </div>
            </div>:
            <RenderEmptySubject code={props.code.courseCode} setter={props.onClose}/>
            }
        </div>
    )
}