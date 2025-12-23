const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const TOTAL_HOURS = 13;

interface CalendarGridProps {
    children: React.ReactNode;
}

export function CalendarGrid({ children }: CalendarGridProps) {
    return (
        <div className="flex h-full">
            {/* Time column */}
            <div className="w-12 flex-shrink-0 border-r border-base-300 bg-base-200 relative">
                {HOURS.map((hour, index) => (
                    <div
                        key={hour}
                        className="absolute left-0 right-0 text-xs text-content-secondary text-right pr-1"
                        style={{
                            top: `${(index / TOTAL_HOURS) * 100}%`,
                            height: `${100 / TOTAL_HOURS}%`,
                        }}
                    >
                        {hour}
                    </div>
                ))}
            </div>

            {/* Calendar grid lines and content */}
            <div className="flex-1 relative flex">
                {/* Grid lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                    {[0, 1, 2, 3, 4].map((dayIndex) => {
                        return (
                            <div
                                key={dayIndex}
                                className="flex-1 border-r border-base-300 last:border-r-0"
                            >
                                {HOURS.map((_, hourIndex) => (
                                    <div
                                        key={hourIndex}
                                        className="border-b border-base-200"
                                        style={{ height: `${100 / TOTAL_HOURS}%` }}
                                    ></div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {children}
            </div>
        </div>
    );
}
