import { UserRound } from "lucide-react";
import { RoundButton, RoundIconButton } from "../button_round/round_button";
import { RectButton } from "../rect_button/rect_button";
import { ArrowRight } from 'lucide-react';

export interface NavProps{

}
export function Nav(_:NavProps){
    return (
        <nav className="relative w-full h-16 bg-gray-50 shadow-xl p-2 font-dm select-none pl-4 flex flex-row items-center">
            <img draggable={false} src="./logo2.png" className="h-3/4 w-fit object-contain object-center"></img>
            {/*Tabs*/}
            <div className="hidden absolute left-50 top-0 h-full min-w-64 w-fit md:flex flex-row items-center [&>*]:mr-5">
                <RoundIconButton text="Osobní rozvrh" color={"bg-primary"} icon={<ArrowRight></ArrowRight>}/>
                <RoundIconButton text="Testy" color={"bg-primary"} icon={<ArrowRight></ArrowRight>}/>
                <RoundIconButton text="Materiály k výuce" color={"bg-primary"} icon={<ArrowRight></ArrowRight>}/>
            </div>
            {/*Svátek*/}
            <div className="hidden absolute m-auto left-0 right-0 top-0 h-full w-fit 2xl:flex flex-col items-center justify-center">
                <span className="w-fit flex justify-center items-center text-md text-gray-400">Svátek má</span>
                <span className="relative bottom-1 w-fit flex justify-center items-center text-xl text-gray-800">Luděk</span>
            </div>
            {/*Search*/}
            <div className="invisible absolute right-64 top-0 h-full w-64 bg-red-500">

            </div>
            {/*Buttons*/}
            <div className="hidden absolute right-4 top-0 h-full min-w-32 w-fit md:flex flex-row-reverse items-center [&>*]:mr-1">
                <RoundButton icon={<UserRound color="#FFFFFF"/>} color="bg-primary"/>
            </div>
        </nav>
    )
}