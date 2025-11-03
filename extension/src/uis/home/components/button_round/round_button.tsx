import type { ReactNode } from "react";

export interface RoundButtonProps{
    text?:string,
    icon?:ReactNode,
    color:string,
}
export interface RoundIconButtonProps{
    text?:string,
    icon?:ReactNode,
    color:string,
    onClick?:()=>void,
    textscale?:boolean,
    disabled?:boolean,
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
        props.disabled == false || props.disabled == undefined?
        <button className={`${props.text!=null?"hover:[&>*]:left-2":""} pl-4 pr-4 transition-all h-10 min-w-12 rounded-full flex items-center justify-center text-white font-dm cursor-pointer font-semibold flex-row ${props.color}`} onClick={props.onClick}>
            {props.text?<span className={props.textscale?"hidden xl:block":undefined}>{props.text}</span>:<></>}
            {props.icon && <span className={`transition-all relative ${props.text!=null?"left-1":"left-0"} h-fit aspect-square flex items-center justify-center`}>
                {props.icon}
            </span>}
        </button>
        :
        <button className={`pl-4 pr-4 transition-all h-10 min-w-12 rounded-full flex items-center justify-center text-white font-dm cursor-not-allowed font-semibold flex-row ${"bg-gray-300"}`}>
            {props.text?<span className={props.textscale?"hidden xl:block":undefined}>{props.text}</span>:<></>}
            {props.icon && <span className={`transition-all relative ${props.text!=null?"left-1":"left-0"} h-fit aspect-square flex items-center justify-center`}>
                {props.icon}
            </span>}
        </button>
    )
}