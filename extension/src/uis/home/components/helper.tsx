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

export const MOCK_FILES = [
    {
        "subfolder": "",
        "file_name": "Číselné soustavy a teorie informace",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Číselné soustavy a teorie informace",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342513;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Formáty souborů",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Formáty souborů",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342516;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Formáty souborů",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Formáty souborů",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342865;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Kódování a zabezpečení dat při přenosu",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Kódování a zabezpečení dat při přenosu",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342515;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Komprese, archivace a zálohování",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Komprese, archivace a zálohování",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342866;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Počítačová kriminalita",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Počítačová kriminalita",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342868;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Průvodce studiem předmětu",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "19. 9. 2025",
        "files": [
            {
                "name": "Průvodce studiem předmětu",
                "type": "pdf",
                "link": "slozka.pl?id=152411;download=342005;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Přenos a kódování dat",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Přenos a kódování dat",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342863;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Souborové systémy, úvod do OS",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Souborové systémy, úvod do OS",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342867;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Teorie informace a informatika",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Teorie informace a informatika",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342860;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Úvod do informatiky",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Úvod do informatiky",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342859;z=1"
            },
            {
                "name": "Úvod do informatiky",
                "type": "pdf",
                "link": "slozka.pl?id=152412;pril=1;download=56022;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Vnitřní reprezentace dat",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342514;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Vnitřní reprezentace dat I",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat I",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342861;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Vnitřní reprezentace dat II",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Vnitřní reprezentace dat II",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342862;z=1"
            },
            {
                "name": "Vnitřní reprezentace dat II",
                "type": "pdf",
                "link": "slozka.pl?id=152412;pril=1;download=56023;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Zabezpečení dat při přenosu",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "22. 9. 2025",
        "files": [
            {
                "name": "Zabezpečení dat při přenosu",
                "type": "pdf",
                "link": "slozka.pl?id=152412;download=342864;z=1"
            }
        ]
    },
    {
        "subfolder": "",
        "file_name": "Základy práce v prostředí OS typu Unix/Linux",
        "file_comment": "",
        "author": "P. Haluza",
        "date": "18. 9. 2025",
        "files": [
            {
                "name": "Základy práce v prostředí OS typu Unix/Linux",
                "type": "pdf",
                "link": "slozka.pl?id=152413;download=342512;z=1"
            }
        ]
    }
];

export const MOCK_WEEK_SCHEDUELE = [
  {
    "date": "20251020",
    "isConsultation": "false",
    "room": "Q01",
    "roomStructured": {
      "name": "Q01",
      "id": "430"
    },
    "studyId": "141978",
    "endTime": "16:50",
    "facultyCode": "PEF",
    "id": "1871742",
    "startTime": "15:00",
    "isDefaultCampus": "true",
    "courseId": "157994",
    "courseName": "Podniková ekonomika 1",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Alena Melicharová, Ph.D.",
        "id": "1391",
        "shortName": "A. Melicharová"
      }
    ],
    "courseCode": "EBC-PE",
    "periodId": "801"
  },
  {
    "date": "20251021",
    "isConsultation": "false",
    "room": "Q01.48",
    "roomStructured": {
      "name": "Q01.48",
      "id": "492"
    },
    "studyId": "141978",
    "endTime": "08:50",
    "facultyCode": "PEF",
    "id": "1874128",
    "startTime": "07:00",
    "isDefaultCampus": "true",
    "courseId": "159415",
    "courseName": "Počítačové sítě",
    "campus": "Brno - Černá Pole",
    "isSeminar": "true",
    "teachers": [
      {
        "fullName": "Ing. Miroslav Jaroš",
        "id": "32865",
        "shortName": "M. Jaroš"
      }
    ],
    "courseCode": "EBC-PS",
    "periodId": "801"
  },
  {
    "date": "20251021",
    "isConsultation": "false",
    "room": "Q15",
    "roomStructured": {
      "name": "Q15",
      "id": "450"
    },
    "studyId": "141978",
    "endTime": "12:50",
    "facultyCode": "PEF",
    "id": "1879706",
    "startTime": "11:00",
    "isDefaultCampus": "true",
    "courseId": "158160",
    "courseName": "Odborná terminologie v AJ: IS/ICT",
    "campus": "Brno - Černá Pole",
    "isSeminar": "true",
    "teachers": [
      {
        "fullName": "doc. Ing. František Dařena, Ph.D.",
        "id": "1447",
        "shortName": "F. Dařena"
      },
      {
        "fullName": "Ing. Ludmila Kunderová",
        "id": "1722",
        "shortName": "L. Kunderová"
      }
    ],
    "courseCode": "EBA-OTII",
    "periodId": "801"
  },
  {
    "date": "20251022",
    "isConsultation": "false",
    "room": "Q16",
    "roomStructured": {
      "name": "Q16",
      "id": "451"
    },
    "studyId": "141978",
    "endTime": "16:50",
    "facultyCode": "PEF",
    "id": "1879841",
    "startTime": "15:00",
    "isDefaultCampus": "true",
    "courseId": "159861",
    "courseName": "Programovací jazyk Java",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Petr Jedlička, Ph.D.",
        "id": "1732",
        "shortName": "P. Jedlička"
      }
    ],
    "courseCode": "EBC-PJ",
    "periodId": "801"
  },
  {
    "date": "20251022",
    "isConsultation": "false",
    "room": "Q07",
    "roomStructured": {
      "name": "Q07",
      "id": "436"
    },
    "studyId": "141978",
    "endTime": "12:50",
    "facultyCode": "PEF",
    "id": "1879862",
    "startTime": "11:00",
    "isDefaultCampus": "true",
    "courseId": "159861",
    "courseName": "Programovací jazyk Java",
    "campus": "Brno - Černá Pole",
    "isSeminar": "true",
    "teachers": [
      {
        "fullName": "Ing. Petr Jedlička, Ph.D.",
        "id": "1732",
        "shortName": "P. Jedlička"
      }
    ],
    "courseCode": "EBC-PJ",
    "periodId": "801"
  },
  {
    "date": "20251022",
    "isConsultation": "false",
    "room": "Q02",
    "roomStructured": {
      "name": "Q02",
      "id": "431"
    },
    "studyId": "141978",
    "endTime": "16:50",
    "facultyCode": "PEF",
    "id": "1874910",
    "startTime": "15:00",
    "isDefaultCampus": "true",
    "courseId": "159413",
    "courseName": "Úvod do ICT",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Pavel Haluza, Ph.D.",
        "id": "4788",
        "shortName": "P. Haluza"
      }
    ],
    "courseCode": "EBC-UICT",
    "periodId": "801"
  },
  {
    "date": "20251023",
    "isConsultation": "false",
    "room": "Q46",
    "roomStructured": {
      "name": "Q46",
      "id": "473"
    },
    "studyId": "141978",
    "endTime": "12:50",
    "facultyCode": "PEF",
    "id": "1882531",
    "startTime": "11:00",
    "isDefaultCampus": "true",
    "courseId": "157994",
    "courseName": "Podniková ekonomika 1",
    "campus": "Brno - Černá Pole",
    "isSeminar": "true",
    "teachers": [
      {
        "fullName": "Ing. Marie Poláchová, Ph.D.",
        "id": "83974",
        "shortName": "M. Poláchová"
      }
    ],
    "courseCode": "EBC-PE",
    "periodId": "801"
  },
  {
    "date": "20251023",
    "isConsultation": "false",
    "room": "Q03",
    "roomStructured": {
      "name": "Q03",
      "id": "432"
    },
    "studyId": "141978",
    "endTime": "14:50",
    "facultyCode": "PEF",
    "id": "1871466",
    "startTime": "13:00",
    "isDefaultCampus": "true",
    "courseId": "159415",
    "courseName": "Počítačové sítě",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Igor Grellneth, Ph.D.",
        "id": "118619",
        "shortName": "I. Grellneth"
      }
    ],
    "courseCode": "EBC-PS",
    "periodId": "801"
  },
  {
    "date": "20251024",
    "isConsultation": "false",
    "room": "Q03",
    "roomStructured": {
      "name": "Q03",
      "id": "432"
    },
    "studyId": "141978",
    "endTime": "08:50",
    "facultyCode": "PEF",
    "id": "1874897",
    "startTime": "07:00",
    "isDefaultCampus": "true",
    "courseId": "159821",
    "courseName": "Vývoj webových aplikací",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Jan Turčínek, Ph.D.",
        "id": "4097",
        "shortName": "J. Turčínek"
      }
    ],
    "courseCode": "EBC-VWA",
    "periodId": "801"
  },
  {
    "date": "20251024",
    "isConsultation": "false",
    "room": "Q07",
    "roomStructured": {
      "name": "Q07",
      "id": "436"
    },
    "studyId": "141978",
    "endTime": "10:50",
    "facultyCode": "PEF",
    "id": "1875049",
    "startTime": "09:00",
    "isDefaultCampus": "true",
    "courseId": "159821",
    "courseName": "Vývoj webových aplikací",
    "campus": "Brno - Černá Pole",
    "isSeminar": "true",
    "teachers": [
      {
        "fullName": "Ing. Jan Turčínek, Ph.D.",
        "id": "4097",
        "shortName": "J. Turčínek"
      }
    ],
    "courseCode": "EBC-VWA",
    "periodId": "801"
  },
];

export const MOCK_DAY_SCHEDUELE = [
  {
    "date": "20251020",
    "isConsultation": "false",
    "room": "Q01",
    "roomStructured": {
      "name": "Q01",
      "id": "430"
    },
    "studyId": "141978",
    "endTime": "16:50",
    "facultyCode": "PEF",
    "id": "1871742",
    "startTime": "15:00",
    "isDefaultCampus": "true",
    "courseId": "157994",
    "courseName": "Podniková ekonomika 1",
    "campus": "Brno - Černá Pole",
    "isSeminar": "false",
    "teachers": [
      {
        "fullName": "Ing. Alena Melicharová, Ph.D.",
        "id": "1391",
        "shortName": "A. Melicharová"
      }
    ],
    "courseCode": "EBC-PE",
    "periodId": "801"
  },
];