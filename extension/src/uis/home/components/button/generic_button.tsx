export interface ButtonProps{
    text:string,
    color:string,
}
export function GenericButton(props:ButtonProps){
    return (
        <button className={`w-fit h-12 rounded-full flex items-center justify-center p-2 pr-4 pl-4 text-white font-dm cursor-pointer font-semibold ${props.color}`}>
            {props.text}
        </button>
    )
}