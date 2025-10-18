import { useEffect, useState } from "react";
import { getBreakpoint, getSubjectLength, TIME_LIST, /*timeToMinutes*/ } from "../helper";
import type { CalendarSubject } from "./calendar";
//import { fillScheduleGaps } from "../helper1";

export function renderSubjects(subjects:CalendarSubject[]|null,subjectControler:{get:CalendarSubject|null,set:any}){
    if(subjects == null){
        return <></>;
    }
    //
    const SUBJECTS_COPY:CalendarSubject[] = JSON.parse(JSON.stringify(subjects));
    SUBJECTS_COPY.sort((a,b)=>{return parseInt(a.startTime.split(".")[0]) - parseInt(b.startTime.split(".")[0])})
    const NEW_MAP:{[key:number]:boolean} = {};
    for(const time of TIME_LIST){
        NEW_MAP[time] = false;
    }
    //
    for(const SUBJECT of SUBJECTS_COPY){
        const [startInt,endInt] = [parseInt(SUBJECT.startTime.split(".")[0]),parseInt(SUBJECT.endTime.split(".")[0])];
        for(let l=startInt;l<=endInt;l++){
            NEW_MAP[l] = true;
        }
    }
    //
    for(const entry of Object.entries(NEW_MAP)){
        const status = entry[1];
        if(status == false){
            const MOCK_COPY:CalendarSubject = JSON.parse(JSON.stringify(subjects[0]));
            MOCK_COPY.type = "EMPTY";
            MOCK_COPY.startTime = entry[0]+".00";
            MOCK_COPY.endTime = entry[0]+".50";
            SUBJECTS_COPY.push(MOCK_COPY);
        }
    }
    //
    SUBJECTS_COPY.sort((a,b)=>{return parseInt(a.startTime.split(".")[0]) - parseInt(b.startTime.split(".")[0])})
    console.log(SUBJECTS_COPY,NEW_MAP);
    
    //
    const [width,setWidth] = useState(window.innerWidth);
    useEffect(()=>{
        window.onresize = ()=>{setWidth(window.innerWidth)};
    },[]);
    //
    /*
    const NEW_MAP:{[key:number]:null|CalendarSubject} = {};
    for(const time of TIME_LIST){
        NEW_MAP[time] = null;
    }
    //
    /*
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
    console.log("[PARTS] Parts:",NEW_MAP);*/
    //
    //const TIME = "11:15";
    //
    /*function subjectProgress(start:string,end:string){
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
    }*/
    //
    async function subjectClick(data:CalendarSubject){
        subjectControler.set(data);
    }
    //
    return (
        SUBJECTS_COPY.map((data,_)=>{
                const data_value = data;
                const lenght = getSubjectLength(data_value.startTime,data_value.endTime);
                console.log(lenght);
                if(data_value.type == "EMPTY"){
                    return (
                        <div className={`${_==0?"":"ml-2"} ${_==0?"mr-4":"mr-2"} pl-1 w-1/12 pr-1 relative h-full ${/*_>0?"ml-4":""*/""}`}>
                        
                        </div>
                    )
                }else{
                    return (
                        <div style={{width:((lenght/12)*100)+"%"}} className={`${_==0?"":"ml-2"} ${_==0?"mr-4":"mr-2"} pl-1 pr-1 relative h-full bg-gray-50 text-gray-800 shadow-md hover:text-primary transition-all cursor-pointer text-xs xl:text-xl text-center font-dm rounded-2xl flex justify-center items-center ${/*_>0?"ml-4":""*/""}`} onClick={()=>{subjectClick(data_value)}}>
                            {getBreakpoint(width)>2?data_value.subject:data_value.subjectCode}
                            {/*<span className="absolute bottom-3 right-1 text-[10px] font-dm bg-gray-300 p-1 rounded-md">{`${data_value.startTime.replace(".",":")} - ${data_value.endTime.replace(".",":")}`}</span>*/}
                            {/*<span className={`absolute bottom-0 left-0 h-1 bg-primary rounded-full`} style={{width:subjectProgress(data_value.startTime.replace(".",":"),data_value.endTime.replace(".",":"))+"%"}}></span>*/}               
                            <span className={`absolute top-0 left-0 h-full w-1 flex items-center justify-center pt-2 pb-2`}>
                                <span className={`h-full w-full rounded-full ${data_value.type.charAt(0).toLowerCase() == "p" ? "bg-[#00aab4]" : "bg-primary"}`}>

                                </span>
                            </span>
                            <span className="absolute top-1 left-4 text-xs lg:text-base font-semibold text-gray-400">{data_value.room}</span>
                        </div>
                    )
                }
        })
    )
}