import { useEffect, useState, type ReactNode } from "react";
import { Nav } from "../nav/nav";
import SchoolCalendar, { type BlockLesson } from "../scheduele/scheduele";
import { fetchWeekScheduele } from "../subject_fetcher";
import { GenericFooter } from "../footer/footer";

export type ScreenType = "SCHEDUELE"|"REPORT";
export interface ScreenProps{
    type:ScreenType,
}
const SCREEN_ROUTES:{[key in ScreenType]:(type:ScreenType,setter:React.Dispatch<React.SetStateAction<ScreenType | null>>)=>ReactNode} = {
    "SCHEDUELE":(type,setter)=>{return SchedueleScreen(type,setter)},
    "REPORT":(type,setter)=>{return ReportScreen(type,setter)}
}
export function renderScreen(type:ScreenType,setter:React.Dispatch<React.SetStateAction<ScreenType | null>>){
    return SCREEN_ROUTES[type](type,setter) ?? <></>;
}
export function SchedueleScreen(_type:ScreenType,setter:React.Dispatch<React.SetStateAction<ScreenType | null>>){
    const [error,setError] = useState<string>("");
    const [scheduele,setScheduele] = useState<BlockLesson[]|null>(null);
    useEffect(()=>{
        (async()=>{
            const week_scheduele = await fetchWeekScheduele();
            if(week_scheduele == null){
                setError("Při načítání rozvrhu došlo k chybě.");
                return;
            }
            setScheduele(week_scheduele);
        })();
    },[]);
    if(error != ""){
        return (
            <div className="fixed z-999 top-0 left-0 w-full h-full flex flex-col items-center bg-gray-50">
                <Nav setScreen={setter} page="scheduele"/>
                <div className="w-full h-full flex justify-center items-center font-semibold font-dm text-gray-600 text-base">
                    {error}
                </div>
            </div>
        )
    }
    return (
        <div className="fixed z-999 top-0 left-0 w-full h-full flex flex-col items-center bg-gray-50">
            <Nav setScreen={setter} page="scheduele"/>
            <div className="w-full h-full overflow-y-auto modern-scrollbar">
                <h1 className="font-dm text-gray-700 font-semibold xl:text-xl text-center mt-4">Osobní rozvrh</h1>
                <SchoolCalendar hideScroll={false} data={scheduele??[]}/>
            </div>
        </div>
    )
}
export function SchedueleScreenComponent(props:{type:string,setter:React.Dispatch<React.SetStateAction<ScreenType | null>>}){
    const [error,setError] = useState<string>("");
    const [scheduele,setScheduele] = useState<BlockLesson[]|null>(null);
    useEffect(()=>{
        (async()=>{
            const week_scheduele = await fetchWeekScheduele();
            if(week_scheduele == null){
                setError("Při načítání rozvrhu došlo k chybě.");
                return;
            }
            setScheduele(week_scheduele);
        })();
    },[]);
    if(error != ""){
        return (
            <div className="fixed z-999 top-0 left-0 w-full h-full flex flex-col items-center bg-gray-50">
                <Nav setScreen={props.setter} page="scheduele"/>
                <div className="w-full h-full flex justify-center items-center font-semibold font-dm text-gray-600 text-base">
                    {error}
                </div>
                {/*Space filler*/}
                <div className="flex flex-1 w-full"></div>
                {/**/}
                <GenericFooter/>
            </div>
        )
    }
    return (
        <div className="fixed z-999 top-0 left-0 w-full h-full flex flex-col items-center bg-gray-50">
            <Nav setScreen={props.setter} page="scheduele"/>
            <div className="w-full h-full overflow-y-auto modern-scrollbar">
                <h1 className="font-dm text-gray-700 font-semibold xl:text-xl text-center mt-4">Osobní rozvrh</h1>
                <SchoolCalendar hideScroll={false} data={scheduele??[]}/>
                {/*Space filler*/}
                <div className="flex flex-1 w-full"></div>
                {/**/}
                <GenericFooter/>
            </div>
        </div>
    )
}
export function ReportScreen(_type:ScreenType,setter:React.Dispatch<React.SetStateAction<ScreenType | null>>){
    return (
        <div className="fixed z-999 top-0 left-0 w-full h-full">
            <Nav setScreen={setter} page="report"/>

        </div>
    )
}