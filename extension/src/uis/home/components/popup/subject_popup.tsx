import { X } from 'lucide-react';
import type { CalendarSubject } from "../calendar/calendar";
import { GetIdFromLink } from "../helper";
import { getFilesFromId, getStoredSubject } from "../helper_ignore";
import type { FileObject, StoredSubject } from "../object_types";
import { useEffect, useState } from "react";
import { File } from 'lucide-react';
import { UserStar } from 'lucide-react';
import { Map } from 'lucide-react';

export interface SubjectPopupProps{
    code:CalendarSubject,
    setter:React.Dispatch<React.SetStateAction<CalendarSubject | null>>,
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

export function RenderEmptySubject(props:{code:string,setter:any}){
    return (
        <div className="p-1 relative h-140 w-100 xl:h-220 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center">
            <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.setter(null)}}>
                <X size={"2rem"}></X>
            </span>
            <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{`Předmět ${props.code} nenalezen v lokálním uložišti`}</span>
        </div>
    )
}

export function RenderLoading(props:{code:string,setter:any}){
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale">
            <div className="p-1 relative h-140 w-100 xl:h-220 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center justify-center">
                <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.setter(null)}}>
                    <X size={"2rem"}></X>
                </span>
                <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{`Načítání`}</span>
            </div>
        </div>
    )
}

export function SubjectPopup(props:SubjectPopupProps){
    //FETCH SUBJECT FROM STORAGE
    const [subject_data,setSubjectData] = useState<StoredSubject|number|null>(0);
    const [files,setFiles] = useState<FileObject[]|number|null>(0);
    const [loadingfile,setLoadingFile] = useState<boolean>(false);
    //
    function parseName(name:string){
        const MAX_LENGTH = 40;
        if(name.length>MAX_LENGTH){
            const name_deducted = name.substring(0,MAX_LENGTH-3);
            return name_deducted+"...";
        }else{
            return name;
        }
    }
    //
    useEffect(()=>{
        (async()=>{
            const STORED_SUBJECT = await getStoredSubject(props.code.subjectCode);
            setSubjectData(STORED_SUBJECT);
            if(STORED_SUBJECT == null){
                setFiles(null);
                return;
            }
            console.log(GetIdFromLink(STORED_SUBJECT.folderUrl),STORED_SUBJECT.folderUrl);
            const files = await getFilesFromId(GetIdFromLink(STORED_SUBJECT.folderUrl));
            setFiles(files);
        })();
    },[])
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
    if(subject_data == 0){
        return <RenderLoading code={props.code.subjectCode} setter={props.setter}/>
    }
    //
    return (
        <div className="fixed top-0 left-0 w-screen h-screen flex justify-center items-center bg-black/50 backdrop-grayscale font-dm">
            {/*Window*/}
            {subject_data!=null && typeof subject_data != "number"?
            <div className="p-1 pl-4 pr-4 relative h-140 w-100 xl:h-220 xl:w-180 rounded-xl bg-gray-50 shadow-xl flex flex-col items-center font-dm">
                <span className="absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all" onClick={()=>{props.setter(null)}}>
                    <X size={"2rem"}></X>
                </span>
                <span className="w-full h-8 xl:h-16 text-gray-800 flex flex-col justify-center items-center font-dm text-base xl:text-2xl">{subject_data.fullName}</span>
                <span className="w-full h-0.25 bg-gray-200 mb-2"></span>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                    <span className="text-base xl:text-xl text-gray-700 font-medium">Vyučující události</span>
                    <span className="text-base xl:text-lg text-gray-700">{props.code.teacher}</span>
                </div>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                    <span className="text-base xl:text-xl text-gray-700 font-medium">Místnost</span>
                    <span className="w-fit relative text-base xl:text-lg text-gray-700" onClick={()=>{window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${props.code.room}`,"_blank")}}>{props.code.room}<Map className="absolute top-0 -right-1 h-full aspect-square text-primary translate-x-1/1 cursor-pointer"></Map></span>
                </div>
                <div className="text-base text-gray-700 w-full flex flex-col mt-4">
                    <span className="text-base xl:text-xl text-gray-700 font-medium">Dostupné soubory</span>
                    {typeof files == "number" || files == null ?<RenderSubFiles status={files}/>:
                        <div className="w-full h-80 xl:h-150 flex flex-col overflow-auto">
                            {files.length === 0 ? (
                                <RenderSubFiles status={1} />
                            ) : loadingfile ? <RenderSubFiles status={2}/> : (
                                files.map((data, i) =>
                                data.files.map((_, l) => (
                                    <div key={`${i}-${l}`} className="relative w-full min-h-10 flex flex-row items-center text-xs xl:text-base">
                                    <div className="aspect-square h-full flex justify-center items-center">
                                        <File />
                                    </div>
                                    <span
                                        className="text-gray-700 pl-2 pr-2 w-80 hover:text-primary cursor-pointer"
                                        onClick={() => loadFile(_.link)}
                                    >
                                        {l === 0 ? parseName(data.file_name) : parseName(data.file_name + " (" + l.toString()+ ")")}
                                    </span>
                                    <div className="aspect-square h-full flex justify-center items-center">
                                        <UserStar />
                                    </div>
                                    <span className="text-gray-400 ml-2">{data.author}</span>
                                    </div>
                                ))
                                )
                            )}
                        </div>
                    }
                </div>
            </div>:
            <RenderEmptySubject code={props.code.subjectCode} setter={props.setter}/>
            }
        </div>
    )
}