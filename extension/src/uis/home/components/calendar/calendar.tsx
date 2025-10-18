import { useState } from "react";
//import { SCHOOL_TIMES } from "../helper";
import { renderSubjects } from "./render_subjects";
import { SubjectPopup } from "../popup/subject_popup";

export interface CalendarSubject {
    day: string;
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    subjectCode: string;
    faculty: string;
    type: string;
    room: string;
    teacher: string;
}
export interface CalendarProps{
    data:CalendarSubject[]|null,
}
export function Calendar(props:CalendarProps){
    const is_empty = props.data == null || props.data.length == 0;
    //
    const [seleectedSubject,setSelectedSubject] = useState<CalendarSubject|null>(null);
    //
    return (
        <div className="relative w-90/100 h-fit bg-gray-200 rounded-md shadow-md justify flex flex-col items-center p-4">
            <div className="w-full h-6 grid grid-cols-12 gap-0">
                {
                    Array.from([7,8,9,10,11,12,13,14,15,16,17,18]).map((data,_)=>{
                        return (
                            <span className="w-full h-full text-md font-dm font-semibold text-gray-500">
                                {data + ":"+"00"}
                            </span>
                        )
                    })
                }
            </div>
            <span className="w-full bg-gray-300 h-0.5"></span>
            <div className="relative w-full h-20 xl:h-30 mt-2 flex flex-row items-center">
                {is_empty?<div className="w-full h-full flex justify-center items-center text-gray-400 font-dm text-md lg:text-xl">Dnes je čas na odpočinek!</div>:renderSubjects(props.data,{get:seleectedSubject,set:setSelectedSubject})}
            </div>
            {seleectedSubject!=null?<SubjectPopup code={seleectedSubject} setter={setSelectedSubject}/>:<></>}
        </div>
    )
}