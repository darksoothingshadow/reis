import type { ReactNode } from "react";

export interface RoundButtonProps{
    text?:string,
    icon?:ReactNode,
    color:string,
}
export interface RoundIconButtonProps{
    text:string,
    icon:ReactNode,
    color:string,
}
export function RoundButton(props:RoundButtonProps){
    return (
        <button className={`pl-4 pr-4 transition-all h-10 min-w-12 rounded-full flex items-center justify-center text-white font-dm cursor-pointer font-semibold flex-row ${props.color}`}>
            {props.icon != undefined ?<span className="w-12 h-12 flex justify-center items-center rounded-full">
                {props.icon}
            </span>:<></>}
            {props.text}
        </button>
    )
}
export function RoundIconButton(props:RoundIconButtonProps){
    return (
        <button className={`hover:[&>*]:left-2 pl-4 pr-4 transition-all h-10 min-w-12 rounded-full flex items-center justify-center text-white font-dm cursor-pointer font-semibold flex-row ${props.color}`}>
            {props.text}
            <span className="transition-all relative left-1 h-fit aspect-square flex items-center justify-center">
                {props.icon}
            </span>
        </button>
    )
}