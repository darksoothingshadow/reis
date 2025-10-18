import { Nav } from "./components/nav/nav";
import { Spacemaker } from "./components/spacemaker/spacemaker";
import { DAY_NAMES } from "./components/helper";
import { Calendar, type CalendarSubject } from "./components/calendar/calendar";
import { useEffect, useState } from "react";
import { checkStoredSubjects, fetchSubjectsFromServer, storeFetchedSubjects } from "./components/helper_ignore";
import { fetchSchedule } from "./components/utils_shared";

export function HomePage(){
  const date = new Date();
  const [loading,setLoading] = useState<boolean>(true);
  const [error,setError] = useState<string>("");
  const [scheduele,setScheduele] = useState<any>(null);
  //
  useEffect(()=>{
    (async()=>{
      const stored_subjects = await checkStoredSubjects();
      if(stored_subjects == false){
        try {
          const fetched_subjects = await fetchSubjectsFromServer();
          if(Object.keys(fetched_subjects.data).length == 0){
            setError("Nezdařilio se načíst informace ze systému. Zkuste znovu načíst aktuální záložku.")
          }else{
            await storeFetchedSubjects(fetched_subjects);
          }
        } catch (error) {
          console.error(error);
          setError("Při načítání došlo ke kritické chybě. :(");
          return;
        }
      }
      //
      try {
        const schedule:CalendarSubject[] = await fetchSchedule();
        setScheduele(schedule);
      } catch (error) {
        console.error(error);
        setError("Při načítání došlo ke kritické chybě. :(");
        return;
      }
      //
      setLoading(false);
    })();
  },[]);
  //
  if(error != ""){
    return (
      <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none justify-center items-center">
        <span className="font-dm text-base xl:text-xl text-gray-700 font-semibold">{error}</span>
      </div>
    )
  }
  //
  if(loading){
    return (
      <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none justify-center items-center">
        <span className="font-dm text-base xl:text-xl mb-4 text-gray-700 font-semibold">Načítání informací ze systému</span>
        <>
          <style>
              {`@keyframes rotation {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
              }`}
          </style>
          <span className='w-16 h-16'
              style={{
              border: "5px solid #8DC843",
              borderBottomColor: "transparent",
              borderRadius: "50%",
              display: "inline-block",
              boxSizing: "border-box",
              animation: "rotation 1s linear infinite",
              }}
          ></span>
        </>
      </div>
    )
  }
  //
  return (
    <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none">
      <Nav/>
      <Spacemaker space="mt-8"/>
      <span className="font-dm text-lg font-semibold text-gray-800 text-xl">{DAY_NAMES[date.getDay() as keyof typeof DAY_NAMES]+" "+date.getDate()+"."+(date.getMonth()+1)+"."}</span>
      <Spacemaker space="mb-1"/>
      <Calendar data={scheduele}/>
    </div>
  )
}