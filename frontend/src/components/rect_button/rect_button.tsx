export interface RectButtonProps{
    text:string,
    color:string,
}
export function RectButton(props:RectButtonProps){
    return (
        <button className={`transition-all hover:bg-primary w-fit min-w-24 h-12 rounded-md flex items-center justify-center p-2 pr-4 pl-4 text-white font-dm cursor-pointer font-semibold ${props.color}`}>
            {props.text}
        </button>
    )
}