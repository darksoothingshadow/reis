export function GenericFooter(){
    return (
        <footer className="relative w-full h-6 flex flex-row items-center justify-center">
            <span className="absolute right-2 bottom-1 text-xs font-dm text-gray-500">Verze BETA 0.1</span>
            {/*<span className="absolute right-30 bottom-1 text-xs font-dm text-gray-500 hover:text-primary cursor-pointer" onClick={()=>{hideUI()}}>Skrýt rozšíření</span>*/}
            {/* <a href="https://docs.google.com/forms/d/e/1FAIpQLScPMKQD6it07S0TPSDgGxyiOqrqRYKvdLSK3m4xnWYE4vyiwg/viewform" target="_blank" className="absolute left-2 bottom-1 text-xs font-dm text-red cursor-pointer font-semibold">Nahlásit problém</a> */}
            <div className="h-full w-fit text-xs font-dm flex flex-row items-end text-gray-500 pb-1">
            <a className="cursor-pointer hover:text-primary" href="#">Více informací o projektu</a>
            </div>
        </footer>
    )
}