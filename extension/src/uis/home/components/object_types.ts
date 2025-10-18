export interface StoredSubject{
    fullName:string,
    displayName:string,
    subjectCode:string,
    //semester:string,
    folderUrl:string,
    fetchedAt:string,
    //syllabusUrl:string,
}
export interface UniversityPerson{
    id:string,
    fullName:string,
    mail:string,
    officeLocation:string,
    phoneNumber:string,
}
export interface FileObject{
    file_name:string,
    author:string,
    date:string,
    files:FileActual[],
}
export interface FileActual{
    name:string,
    type:string,
    link:string,
}