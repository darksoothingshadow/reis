import type { ReactNode } from "react";

export interface CustomProps{
    text:string,
}
export function CustomUI(props:CustomProps):ReactNode{
    return (
        <div className="w-screen h-screen flex flex-col bg-red-800">
            {props.text}
        </div>
    )
}