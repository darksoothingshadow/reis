import { SCHOOL_TIMES } from "../helper";
import { renderSubjects } from "./render_subjects";

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
    return (
        <div className="relative w-90/100 h-fit bg-gray-200 rounded-md shadow-md justify flex flex-col items-center p-4">
            <div className="w-full h-4 grid grid-cols-13 gap-0">
                {
                    Array.from([7,8,9,10,11,12,13,14,15,16,17,18,19]).map((data,_)=>{
                        return (
                            <span className="w-full h-full text-sm font-dm font-semibold text-gray-500">
                                {data + ":"+"00"}
                            </span>
                        )
                    })
                }
            </div>
            <span className="w-full bg-gray-300 h-0.5"></span>
            <div className="w-full h-30 mt-2 grid grid-cols-13 gap-4">
                {is_empty?<div className="w-full h-full flex justify-center items-center text-gray-400 font-dm text-lg">Na dnešek nemáte žádný rozvrh</div>:renderSubjects(props.data)}
            </div>
        </div>
    )
}