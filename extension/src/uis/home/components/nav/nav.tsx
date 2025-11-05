import { RoundIconButton } from "../button_round/round_button";
import { ArrowRight } from 'lucide-react';
import { MENDELU_IMAGE, OUTLOOK_IMAGE, TEAMS_IMAGE, type GenericProps } from "../variables";
// import { performLogOut } from "../logout";

export interface NavProps extends GenericProps{
    page?:string,
}
function ReportNav(_:NavProps){
    return (
        <nav className="relative w-full h-16 bg-gray-50 shadow-xl p-2 font-dm select-none pl-4 flex flex-row items-center">
            <img draggable={false} src={MENDELU_IMAGE} className="h-3/4 w-fit object-contain object-center cursor-pointer" onClick={_.setScreen?()=>{_.setScreen?_.setScreen(null):undefined}:undefined}></img>
            {/*Buttons*/}
            <div className="hidden absolute right-4 top-0 h-full min-w-32 w-fit md:flex flex-row-reverse items-center [&>*]:mr-1">
                {/*<RoundButton icon={<UserRound color="#FFFFFF"/>} color="bg-primary"/>*/}
                <RoundIconButton text="Zrušit hlášení" color={"bg-red"} icon={<ArrowRight></ArrowRight>} onClick={_.setScreen?()=>{_.setScreen?_.setScreen(null):undefined}:undefined}/>
            </div>
        </nav>
    ) 
}
function SchedueleNav(_:NavProps){
    return (
        <nav className="relative w-full h-16 bg-gray-50 shadow-xl p-2 font-dm select-none pl-4 flex flex-row items-center">
            <img draggable={false} src={MENDELU_IMAGE} className="h-3/4 w-fit object-contain object-center cursor-pointer" onClick={_.setScreen?()=>{_.setScreen?_.setScreen(null):undefined}:undefined}></img>
            {/*Tabs*/}
            <div className="hidden absolute left-50 top-0 h-full min-w-64 w-fit md:flex flex-row items-center [&>*]:mr-5">
                <RoundIconButton text="Osobní rozvrh" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={_.setScreen?()=>{_.setScreen?_.setScreen("SCHEDUELE"):undefined}:undefined}/>
                <RoundIconButton text="Testy" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={()=>{window.open("https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?;lang=cz","_blank")}}/>
                <RoundIconButton text="Materiály k výuce" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={()=>{window.open("https://is.mendelu.cz/auth/student/list.pl?lang=cz", "_blank")}}/>
            </div>
            {/*Buttons*/}
            <div className="hidden absolute right-4 top-0 h-full min-w-32 w-fit md:flex flex-row-reverse items-center [&>*]:mr-1">
                {/*<RoundButton icon={<UserRound color="#FFFFFF"/>} color="bg-primary"/>*/}
                {/* <RoundIconButton text="Odhlásit se" color={"bg-red"} icon={<ArrowRight></ArrowRight>} onClick={()=>{performLogOut()}} textscale/> */}
                <RoundIconButton text="Nahlásit problém!" color={"bg-red"} onClick={()=>{window.open("https://docs.google.com/forms/d/e/1FAIpQLScPMKQD6it07S0TPSDgGxyiOqrqRYKvdLSK3m4xnWYE4vyiwg/viewform","_blank")}} textscale/>
                <img 
                    src={OUTLOOK_IMAGE} 
                    alt="Outlook" 
                    className="w-8 h-8  cursor-pointer hover:opacity-80 transition-opacity object-cover" 
                    onClick={()=>{window.open("https://outlook.com/mendelu.cz","_blank")}}
                />
                <img 
                    src={TEAMS_IMAGE} 
                    alt="Teams" 
                    className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity object-cover" 
                    onClick={()=>{window.open("https://teams.microsoft.com/v2/","_blank")}}
                />
            </div>
        </nav>
    ) 
}
export function Nav(_:NavProps){
    if(_.page == undefined || _.page == "home"){
        return (
            <nav className="relative w-full h-16 bg-gray-50 shadow-xl p-2 font-dm select-none pl-4 flex flex-row items-center">
                <img draggable={false} src={MENDELU_IMAGE} className="h-3/4 w-fit object-contain object-center cursor-pointer" onClick={() => {}}></img>
                {/*Tabs*/}
                <div className="hidden absolute left-50 top-0 h-full min-w-64 w-fit md:flex flex-row items-center [&>*]:mr-5">
                    <RoundIconButton text="Osobní rozvrh" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={_.setScreen?()=>{_.setScreen?_.setScreen("SCHEDUELE"):undefined}:undefined}/>
                    <RoundIconButton text="Testy" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={()=>{window.open("https://is.mendelu.cz/auth/elis/ot/psani_testu.pl?;lang=cz","_blank")}}/>
                    <RoundIconButton text="Materiály k výuce" color={"bg-primary"} icon={<ArrowRight></ArrowRight>} onClick={()=>{window.open("https://is.mendelu.cz/auth/student/list.pl?lang=cz", "_blank")}}/>
                </div>
                {/*Svátek*/}
                <div className="invisible absolute m-auto left-0 right-0 top-0 h-full w-fit 2xl:flex flex-col items-center justify-center">
                    <span className="w-fit flex justify-center items-center text-md text-gray-400">Svátek má</span>
                    <span className="relative bottom-1 w-fit flex justify-center items-center text-xl text-gray-800">Luděk</span>
                </div>
                {/*Search*/}
                <div className="invisible absolute right-64 top-0 h-full w-64 bg-red-500">

                </div>
                {/*Buttons*/}
                <div className="hidden absolute right-4 top-0 h-full min-w-32 w-fit md:flex flex-row-reverse items-center [&>*]:mr-1">
                    {/*<RoundButton icon={<UserRound color="#FFFFFF"/>} color="bg-primary"/>*/}
                    {/*<RoundIconButton text="Odhlásit se" color={"bg-red"} icon={<ArrowRight></ArrowRight>} onClick={_.setScreen?()=>{_.setScreen?_.setScreen("REPORT"):undefined}:undefined} textscale/>*/}
                    <RoundIconButton text="Nahlásit problém!" color={"bg-red"} onClick={()=>{window.open("https://docs.google.com/forms/d/e/1FAIpQLScPMKQD6it07S0TPSDgGxyiOqrqRYKvdLSK3m4xnWYE4vyiwg/viewform","_blank")}} textscale/>
                    <img 
                        src={OUTLOOK_IMAGE} 
                        alt="Outlook" 
                        className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity object-cover" 
                        onClick={()=>{window.open("https://outlook.com/mendelu.cz","_blank")}}
                    />
                    <img 
                        src={TEAMS_IMAGE} 
                        alt="Teams" 
                        className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity object-cover" 
                        onClick={()=>{window.open("https://teams.microsoft.com/v2/","_blank")}}
                    />
                </div>
            </nav>
        )
    }else{
        switch(_.page.toLowerCase()){
            case "report":
                return <ReportNav setScreen={_.setScreen}/>
            case "scheduele":
                return <SchedueleNav setScreen={_.setScreen}/>
        } 
    }
    
}