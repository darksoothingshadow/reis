import { useEffect, useState } from "react";
import { getBreakpoint, getSubjectLength, minutesToTimeDefault, SCHOOL_BLOCKS, TIME_LIST, timeToMinutes, timeToMinutesDefault, type SchoolBlocks } from "../helper";
import type { CalendarSubject } from "./calendar";

export function renderSubjects(subjects:CalendarSubject[]|null){
    if(subjects == null){
        return <></>;
    }
    //
    const [width,setWidth] = useState(window.innerWidth);
    useEffect(()=>{
        window.onresize = (e)=>{setWidth(window.innerWidth)};
    },[]);
    //
    const NEW_MAP:{[key:number]:null|CalendarSubject} = {};
    for(const time of TIME_LIST){
        NEW_MAP[time] = null;
    }
    //
    const SUBJECTS_COPY:CalendarSubject[] = JSON.parse(JSON.stringify(subjects));
    for(const subject of SUBJECTS_COPY){
        console.log("[PARSING] New subject: ",subject);
        const lenght = getSubjectLength(subject.startTime,subject.endTime);
        console.log("[PARSING] Length: ",lenght);
        const CUT_PARTS = [];
        for(let l=0;l<lenght;l++){
            const COPY:CalendarSubject = JSON.parse(JSON.stringify(subject));
            COPY.startTime = minutesToTimeDefault(timeToMinutesDefault(subject.startTime) + (l * 60));
            COPY.endTime = minutesToTimeDefault(timeToMinutesDefault(COPY.startTime) + 60);
            CUT_PARTS.push(COPY);
        };
        //
        console.log("[PARSING] CUT: ",CUT_PARTS);
        //
        for(const CUT_PART of CUT_PARTS){
            const hour = parseInt(CUT_PART.startTime.split(".")[0]);
            NEW_MAP[hour] = CUT_PART;
        }
        //
    };
    //
    console.log("[PARTS] Parts:",NEW_MAP);
    //
    const TIME = "11:15";
    //
    function subjectProgress(start:string,end:string){
        const [starttime,endtime] = [timeToMinutes(start),timeToMinutes(end)];
        const current_time = timeToMinutes(TIME);
        //
        console.log(start,starttime,endtime,current_time);
        //
        if(current_time<starttime){
            return "0";
        }
        if(current_time>endtime){
            return "100";
        }
        // 1. Calculate the total duration of the subject
        const duration = endtime - starttime; 
        // 2. Calculate the time elapsed since the start of the subject
        const elapsedTime = current_time - starttime;
        // 3. Calculate the percentage: (Elapsed Time / Total Duration) * 100
        // Use Math.round or toFixed(0) for a cleaner integer percentage
        const percent = Math.round((elapsedTime / duration) * 100);
        return percent;
    }
    //
    return (
        Object.entries(NEW_MAP).map((data,_)=>{
            if(data[1] == null){
                //RENDER BLACk BLOCK
                return (
                    <div className={`relative w-1/7 h-full ${/*_>0?"ml-4":""*/""}`}>
                        
                    </div>
                )
            }else{
                const data_value = data[1];
                return (
                    <div className={`pl-1 pr-1 relative w-full h-full bg-gray-50 text-gray-800 shadow-md hover:text-primary transition-all cursor-pointer text-xs xl:text-base text-center font-dm rounded-2xl flex justify-center items-center ${/*_>0?"ml-4":""*/""}`}>
                        {getBreakpoint(width)>2?data_value.subject:data_value.subjectCode}
                        {/*<span className="absolute bottom-3 right-1 text-[10px] font-dm bg-gray-300 p-1 rounded-md">{`${data_value.startTime.replace(".",":")} - ${data_value.endTime.replace(".",":")}`}</span>*/}
                        {/*<span className={`absolute bottom-0 left-0 h-1 bg-primary rounded-full`} style={{width:subjectProgress(data_value.startTime.replace(".",":"),data_value.endTime.replace(".",":"))+"%"}}></span>*/}               
                        <span className={`absolute top-0 left-0 h-full w-1 flex items-center justify-center pt-2 pb-2`}>
                            <span className={`h-full w-full rounded-full ${data_value.type.charAt(0).toLowerCase() == "p" ? "bg-[#00aab4]" : "bg-primary"}`}>

                            </span>
                        </span>
                    </div>
                )
            }
        })
    )
}