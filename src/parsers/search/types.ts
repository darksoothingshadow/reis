/**
 * Search Parser Types
 * 
 * Shared interfaces for search result parsing.
 */

export interface Person {
    id: string | null;
    name: string;
    link: string;
    faculty: string;
    programAndMode: string;
    status: string;
    rawDetails: string;
    type: 'student' | 'teacher' | 'staff' | 'unknown';
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    link: string;
    faculty: string;
    facultyColor: string;
    semester: string;
}

/**
 * Check if a person is a student based on their raw details.
 */
export const isStudentFromDetails = (rawDetails: string): boolean => {
    const hasStudentIndicators = rawDetails.includes('[') && (
        rawDetails.includes('term') ||
        rawDetails.includes('year') ||
        rawDetails.includes('ročník') ||
        rawDetails.includes('roč') ||
        rawDetails.includes('sem')
    );

    const hasStudyProgramIndicators =
        rawDetails.includes(' pres ') ||
        rawDetails.includes(' prez ') ||
        rawDetails.includes(' komb ') ||
        rawDetails.includes('Bachelor') ||
        rawDetails.includes('Master') ||
        rawDetails.includes('Bakalářský') ||
        rawDetails.includes('Magisterský') ||
        rawDetails.includes('Doktorský') ||
        rawDetails.includes('prezenční') ||
        rawDetails.includes('kombinovaná') ||
        rawDetails.includes('Univerzita třetího věku') ||
        rawDetails.includes('Celoživotní vzdělávání') ||
        rawDetails.includes('U3V');

    return hasStudentIndicators || hasStudyProgramIndicators;
};

/**
 * Classify a person as student, teacher, or staff based on name and details.
 */
export const classifyPersonType = (name: string, rawDetails: string): 'student' | 'teacher' | 'staff' => {
    if (isStudentFromDetails(rawDetails)) {
        return 'student';
    }

    const nameLower = name.toLowerCase();
    if (
        nameLower.includes('ph.d.') ||
        nameLower.includes('csc.') ||
        nameLower.includes('drsc.') ||
        nameLower.includes('dr.') ||
        nameLower.includes('doc.') ||
        nameLower.includes('prof.') ||
        nameLower.includes('th.d.')
    ) {
        return 'teacher';
    }

    return 'staff';
};
