import type { CalendarSubject } from "./calendar/calendar";

export const MOCK_DATA = [
  {
    "day": "St",
    "date": "08.10.2025",
    "startTime": "7.00",
    "endTime": "9.50",
    "subject": "Základy objektového návrhu",
    "subjectCode": "EBC-ZOO",
    "faculty": "PEF",
    "type": "Cvičení",
    "room": "Q07",
    "teacher": "M. Matonoha"
  },
  {
    "day": "St",
    "date": "08.10.2025",
    "startTime": "15.00",
    "endTime": "16.50",
    "subject": "Úvod do ICT",
    "subjectCode": "EBC-UICT",
    "faculty": "PEF",
    "type": "Přednáška",
    "room": "Q02",
    "teacher": "P. Haluza"
  },
  {
    "day": "Čt",
    "date": "08.10.2025",
    "startTime": "10.00",
    "endTime": "12.50",
    "subject": "Algoritmizace",
    "subjectCode": "EBC-ALG",
    "faculty": "PEF",
    "type": "Přednáška",
    "room": "Q02",
    "teacher": "J. Rybička"
  },
];

export const SCHOOL_BLOCKS = {
  "7":null,
  "9":null,
  "11":null,
  "13":null,
  "15":null,
  "17":null,
}
export type SchoolBlocks = {
    "7": null|CalendarSubject;
    "9": null|CalendarSubject;
    "11": null|CalendarSubject;
    "13": null|CalendarSubject;
    "15": null|CalendarSubject;
    "17": null|CalendarSubject;
};
const BRAKPOINTS = {
  0:640,
  1:768,
  2:1024,
  3:1280,
  4:1536,
}

export const SCHOOL_TIMES = [
  "07:00 - 08:50",
  "09:00 - 10:50",
  "11:00 - 12:50",
  "13:00 - 14:50",
  "15:00 - 16:50",
  "17:00 - 18:50",
]

export const TIME_LIST = [7,8,9,10,11,12,13,14,15,16,17,18];

export function getBreakpoint(width:number):number{
  if(width<=BRAKPOINTS[0]){
    return 0;
  }
  if(width>=BRAKPOINTS[4]){
    return 4;
  }
  for(const entry of Object.entries(BRAKPOINTS)){
    if(width<entry[1]){
      return parseInt(entry[0]);
    }
  }
  return 0;
}

export function getSubjectLength(start:string,end:string){
  const [startTime,endTime] = [timeToMinutesDefault(start),timeToMinutesDefault(end)];
  //
  const diff = endTime - startTime;
  //
  const lenght = Math.ceil(diff/60);
  return lenght;
}

export function timeToMinutes(time:string):number{
  const parts = time.split(":");
  if(parts.length == 2){
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }else{
      return 0;
  }
}

export function timeToMinutesDefault(time:string):number{
  const parts = time.split(".");
  if(parts.length == 2){
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }else{
      return 0;
  }
}

export function minutesToTimeDefault(time: number): string {
  // Ensure the time is within a 24-hour cycle (0 to 1439 minutes)
  const totalMinutes = time % 1440;

  // Calculate the hour (integer division)
  const hours = Math.floor(totalMinutes / 60);

  // Calculate the remaining minutes
  const minutes = totalMinutes % 60;

  // Format the minutes to always be two digits (e.g., 5 becomes "05")
  const formattedMinutes = String(minutes).padStart(2, '0');

  // Return the time in the format "hours.minutes"
  return `${hours}.${formattedMinutes}`;
}

export const DAY_NAMES = {
  0:"Ne",
  1:"Po",
  2:"Út",
  3:"St",
  4:"Čt",
  5:"Pá",
  6:"So",
}

export const MOCK_SUBJECT = {
  subjectCode:"CODE",
  credits:6,
  
}

export function GetIdFromLink(link:string):string|null{
  const pathString = link;

  // Regex: Look for 'id=' followed by one or more digits (\d+).
  // The value inside the parenthesis is the capture group.
  const match = pathString.match(/id=(\d+)/);

  // Extract the captured group (index 1) if a match was found
  const id = match ? match[1] : null;
  return id;
}

export const sleep = (delay:number) => new Promise((resolve) => setTimeout(resolve, delay));