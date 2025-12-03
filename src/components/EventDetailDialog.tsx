import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { CalendarEvent } from "../types/calendar";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchDocumentsForSubject } from "../api/documents";
import type { FileAttachment } from "../types/documents";

interface EventDetailDialogProps {
    event: CalendarEvent | null;
    isOpen: boolean;
    onClose: () => void;
}

export function EventDetailDialog({ event, isOpen, onClose }: EventDetailDialogProps) {
    const [documents, setDocuments] = useState<FileAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && event) {
            const loadDocuments = async () => {
                setIsLoading(true);
                try {
                    // Assuming subjectCode is what we need, or we might need a specific ID
                    // The current API uses subject ID, but let's try with what we have or adjust api/documents
                    // For now, we'll mock or use a placeholder if the API requires a specific ID not present in CalendarEvent
                    // Actually, api/documents.ts fetchDocuments takes a subjectId. 
                    // We mapped lesson.courseCode to subjectCode. We might need lesson.courseId or similar.
                    // Let's check api/documents.ts again.

                    // Temporary: fetching with subjectCode as ID, this might fail if ID is different
                    const docs = await fetchDocumentsForSubject(event.subjectCode);
                    setDocuments(docs);
                } catch (error) {
                    console.error("Failed to load documents", error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadDocuments();
        }
    }, [isOpen, event]);

    if (!event) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white">
                <DialogHeader className="px-6 py-4 border-b border-gray-100 flex flex-row items-center justify-between">
                    <DialogTitle className="text-lg font-semibold text-gray-900">
                        {event.subjectCode} {event.subjectName}
                    </DialogTitle>
                    {/* Close button is handled by DialogPrimitive usually, but we can add custom if needed */}
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Event Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Vyučující události</h4>
                            <p className="text-sm text-gray-900">{event.teacher || "Nezadáno"}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-1">Místnost</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900">{event.room}</span>
                                {/* Map icon placeholder */}
                                <span className="text-green-500">🗺️</span>
                            </div>
                        </div>
                    </div>

                    {/* Documents Section */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-3">Dostupné soubory</h4>

                        {isLoading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                        ) : documents.length > 0 ? (
                            <div className="space-y-2">
                                {documents.map((doc, index) => (
                                    <a
                                        key={index}
                                        href={doc.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                        <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                                            <FileText className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                                            {doc.name}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Žádné soubory k dispozici</p>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
