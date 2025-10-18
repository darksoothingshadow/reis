import type { FileObject, StoredSubject } from "./object_types";
import { fetchServerFilesById, fetchSubjects, parseServerFiles, showFullSubjects, type SubjectsData } from "./utils_shared";

export const FAKE_STORAGE:{[key:string]:StoredSubject} = {
    "EBC-ZOO":{
        fullName:"Základy objektového návrhhu",
        displayName:"ZOO",
        subjectCode:"EBC-ZOO",
        //semester:"ZS",
        folderUrl:"auth/dok_server/slozka.pl?;id=150956",
        fetchedAt:"13.10.2025",
        //syllabusUrl:"",
    },
}

export async function getStoredSubject(code:string):Promise<StoredSubject|null>{
    const storage = window.localStorage;
    const value = storage.getItem("stored_subjects");
    if(value == null){
        return null;
    };
    //
    const subject_map:SubjectsData = JSON.parse(value);
    const subject = subject_map.data[code];
    return subject;
}

export async function getFilesFromId(id:string|null):Promise<FileObject[]>{
    if(id == null){
        return [];
    }
    const files_html = await fetchServerFilesById(id);
    if(files_html == null){
        return [];
    }else{
        const files_actual = await parseServerFiles(files_html);
        return files_actual;
    }
    /*
    await sleep(2000);
    return [
    {
        "file_name": "Číselné soustavy a teorie informace",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Číselné soustavy a teorie informace",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342513;z=1"
            }
        ]
    },
    {
        "file_name": "Formáty souborů",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Formáty souborů",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342516;z=1"
            }
        ]
    },
    {
        "file_name": "Formáty souborů",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Formáty souborů",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342865;z=1"
            }
        ]
    },
    {
        "file_name": "Kódování a zabezpečení dat při přenosu",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Kódování a zabezpečení dat při přenosu",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342515;z=1"
            }
        ]
    },
    {
        "file_name": "Komprese, archivace a zálohování",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Komprese, archivace a zálohování",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342866;z=1"
            }
        ]
    },
    {
        "file_name": "Počítačová kriminalita",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Počítačová kriminalita",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342868;z=1"
            }
        ]
    },
    {
        "file_name": "Průvodce studiem předmětu",
        "author": "P. Haluza",
        "date": "19. 9. 2025",
        "files": [
            {
                "name": "Průvodce studiem předmětu",
                "type": "pdf",
                "link": "slozka.pl?id=152411;download=342005;z=1"
            }
        ]
    },
    {
        "file_name": "Přenos a kódování dat",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Přenos a kódování dat",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342863;z=1"
            }
        ]
    },
    {
        "file_name": "Souborové systémy, úvod do OS",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Souborové systémy, úvod do OS",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342867;z=1"
            }
        ]
    },
    {
        "file_name": "Teorie informace a informatika",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Teorie informace a informatika",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342860;z=1"
            }
        ]
    },
    {
        "file_name": "Úvod do informatiky",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Úvod do informatiky",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342859;z=1"
            },
            {
                "name": "Úvod do informatiky",
                "type": "pdf",
                "link": "slozka.pl?id=152412;pril=1;download=56022;z=1"
            }
        ]
    },
    {
        "file_name": "Vnitřní reprezentace dat",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342514;z=1"
            }
        ]
    },
    {
        "file_name": "Vnitřní reprezentace dat I",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat I",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342861;z=1"
            }
        ]
    },
    {
        "file_name": "Vnitřní reprezentace dat II",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat II",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342862;z=1"
            },
            {
                "name": "Vnitřní reprezentace dat II",
                "type": "pdf",
                "link": "slozka.pl?id=152412;pril=1;download=56023;z=1"
            }
        ]
    },
    {
        "file_name": "Zabezpečení dat při přenosu",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Zabezpečení dat při přenosu",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342864;z=1"
            }
        ]
    },
    {
        "file_name": "Základy práce v prostředí OS typu Unix/Linux",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Základy práce v prostředí OS typu Unix/Linux",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342512;z=1"
            }
        ]
    }
]*/
}


export async function checkStoredSubjects():Promise<boolean>{
    const storage = window.localStorage;
    const stored = storage.getItem("stored_subjects");
    return stored != null;
}

export async function fetchSubjectsFromServer():Promise<SubjectsData>{
    const subject_fetch = await fetchSubjects();
    const full_subjects = showFullSubjects(subject_fetch);
    return full_subjects;
}

export async function storeFetchedSubjects(subjects:SubjectsData):Promise<boolean>{
    const storage = window.localStorage;
    //
    storage.setItem("stored_subjects",JSON.stringify(subjects));
    //
    return true;
}