import { Nav } from "./components/nav/nav";
import { Spacemaker } from "./components/spacemaker/spacemaker";
import { MOCK_DATA } from "./components/helper";
import { Calendar } from "./components/calendar/calendar";

export function App(){
  const date = new Date();
  return (
    <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none">
      <Nav/>
      <Spacemaker space="mt-8"/>
      <span className="font-dm text-lg font-semibold text-gray-800">{date.getDate()+"."+(date.getMonth()+1)}</span>
      <Calendar data={MOCK_DATA}/>
    </div>
  )
}