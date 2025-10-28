import { Nav } from "./components/nav/nav";
import { Spacemaker } from "./components/spacemaker/spacemaker";
import { useEffect, useState } from "react";
import { checkStoredSubjects, fetchSubjectsFromServer, storeFetchedSubjects } from "./components/helper_ignore";
import { Divider } from "./components/devider/devider";
import { Ellipsis } from "lucide-react";
import { SchedueleScreenComponent } from "./components/screens/screens";
import SchoolCalendar, { type BlockLesson } from "./components/scheduele/scheduele";
import { fetchDayScheduele } from "./components/subject_fetcher";
import { GenericFooter } from "./components/footer/footer";

export function HomePage(){
  const [loading,setLoading] = useState<boolean>(true);
  const [error,setError] = useState<string>("");
  const [scheduele,setScheduele] = useState<BlockLesson[]|null>(null);
  const [currentRoute, setCurrentRoute] = useState(window.location.pathname);
  
  // Check URL to determine which screen to show
  const isScheduleScreen = currentRoute.includes('/osobni_rozvrh');
  
  // Function to navigate to schedule by changing URL
  const navigateToSchedule = () => {
    window.history.pushState({}, '', '/auth/osobni_rozvrh');
    setCurrentRoute('/auth/osobni_rozvrh');
  };
  
  // Function to navigate home
  const navigateToHome = () => {
    window.history.pushState({}, '', '/auth/');
    setCurrentRoute('/auth/');
  };
  
  // Listen for URL changes (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  //
  useEffect(()=>{
    (async()=>{
      // Check if cached user_id matches current logged-in user
      const cachedUserId = localStorage.getItem("user_id");
      if (cachedUserId) {
        // Fetch current user's actual ID
        const currentUserId = await (async () => {
          try {
            const response = await fetch("https://is.mendelu.cz/auth/student/studium.pl");
            const html = await response.text();
            const parser = new DOMParser().parseFromString(html, "text/html");
            const tds = parser.getElementsByTagName("td");
            for (let i = 0; i < tds.length; i++) {
              if (tds[i].innerText?.toLowerCase().includes("identif")) {
                return tds[i + 1]?.innerText.replace(" ", "") || null;
              }
            }
            return null;
          } catch {
            return null;
          }
        })();
        
        // If IDs don't match, clear all cached data
        if (currentUserId && currentUserId !== cachedUserId) {
          console.log(`[STORAGE] User changed from ${cachedUserId} to ${currentUserId}, clearing cache`);
          localStorage.clear(); // Clear everything
        }
      }
      
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
      //SCHEDUELE FETCHING
      const scheduele = await fetchDayScheduele();
      if(scheduele == null){
        setError("Při načítání rozvrhu došlo ke kritické chybě. :(");
        return;
      }
      //
      setScheduele(scheduele);
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
  // Render schedule screen or home screen based on URL
  if (isScheduleScreen) {
    return <SchedueleScreenComponent type="SCHEDUELE" setter={()=>navigateToHome()}/>;
  }
  //
  return (
    <div className="w-screen h-screen flex flex-col items-center bg-gray-50 select-none">
      <Nav setScreen={()=>navigateToSchedule()}/>
      <Spacemaker space="mt-8"/>
      <span className="font-dm text-lg font-semibold text-gray-800 text-xl">{"Dnešní rozvrh"}</span>
      <Spacemaker space="mb-1"/>
      {/*Scheduele*/}
      <SchoolCalendar data={scheduele??[]}/>
      {/*Scheduele*/}
      <Divider customStyle="mt-8"/>
      <section className="w-full h-fit flex flex-row items-center pl-16 pr-16 mt-1 font-dm">
        <div className="h-64 w-fit min-w-64 p-2">
          <span className="flex flex-row items-center"><Ellipsis className="mr-1"></Ellipsis>Jiné</span>
          <ul className="list-disc list-outside pl-8 w-full">
            <li><a href="https://is.mendelu.cz/auth/student/moje_studium.pl?_m=3110;lang=cz" target="_blank" className="hover:text-primary">Portál studenta</a></li>
            <li><a href="https://is.mendelu.cz/auth/verejne_informace.pl?_m=8301;lang=cz" target="_blank" className="hover:text-primary">Další informace o Mendelu</a></li>
            <li><a href="https://is.mendelu.cz/auth/student/hodnoceni.pl?_m=3167;lang=cz" target="_blank" className="hover:text-primary">Hodnocení úspešnosti předmětů</a></li>
            <li><a href="https://is.mendelu.cz/auth/dok_server/?_m=229;lang=cz" target="_blank" className="hover:text-primary">Dokumentový server</a></li>
            <li><a href="https://is.mendelu.cz/auth/kc/kc.pl?zalozka=novy;lang=cz" target="_blank" className="hover:text-primary">Žádosti a formuláře</a></li>
            <li><a href="https://is.mendelu.cz/auth/evolby/portal_volice.pl?_m=23942;lang=cz" target="_blank" className="hover:text-primary">Portál voliče</a></li>
            <li><a href="https://is.mendelu.cz/auth/wifi/certifikat.pl?_m=177;lang=cz" target="_blank" className="hover:text-primary">Návod pro EduRoam (Wi-Fi)</a></li>
          </ul>
        </div>
      </section>
      {/*Space filler*/}
      <div className="flex flex-1 w-full"></div>
      {/**/}
      <GenericFooter/>
    </div>
  )
}