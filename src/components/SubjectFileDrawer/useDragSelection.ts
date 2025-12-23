/**
 * useDragSelection Hook
 * 
 * Manages drag-to-select behavior for file lists.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

interface UseDragSelectionOptions {
    isOpen: boolean;
    containerRef: React.RefObject<HTMLDivElement | null>;
    contentRef: React.RefObject<HTMLDivElement | null>;
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

interface UseDragSelectionResult {
    // State
    selectedIds: string[];
    isDragging: boolean;
    selectionBoxStyle: { left: number; top: number; width: number; height: number } | null;
    
    // Refs
    ignoreClickRef: React.MutableRefObject<boolean>;
    
    // Actions
    handleMouseDown: (e: React.MouseEvent) => void;
    toggleSelect: (id: string, e: React.MouseEvent) => void;
    clearSelection: () => void;
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useDragSelection({
    isOpen,
    containerRef,
    contentRef,
    fileRefs
}: UseDragSelectionOptions): UseDragSelectionResult {
    // State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);

    // Refs
    const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);
    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const initialSelectedIds = useRef<string[]>([]);
    const isDraggingRef = useRef(false);
    const selectionStartRef = useRef<{ x: number, y: number } | null>(null);
    const ignoreClickRef = useRef(false);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            setSelectionStart(null);
            setSelectionEnd(null);
            isDraggingRef.current = false;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [isOpen]);

    // Process selection based on mouse position
    const processSelection = useCallback((clientX: number, clientY: number) => {
        if (!selectionStartRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left + containerRef.current.scrollLeft;
        const y = clientY - rect.top + containerRef.current.scrollTop;

        const contentWidth = contentRef.current ? contentRef.current.scrollWidth : containerRef.current.scrollWidth;
        const contentHeight = contentRef.current ? contentRef.current.scrollHeight : containerRef.current.scrollHeight;
        
        const clampedX = Math.max(0, Math.min(x, contentWidth));
        const clampedY = Math.max(0, Math.min(y, contentHeight));

        setSelectionEnd({ x: clampedX, y: clampedY });

        const boxLeft = Math.min(selectionStartRef.current.x, clampedX);
        const boxTop = Math.min(selectionStartRef.current.y, clampedY);
        const boxRight = Math.max(selectionStartRef.current.x, clampedX);
        const boxBottom = Math.max(selectionStartRef.current.y, clampedY);

        const newSelectedIds = new Set(initialSelectedIds.current);

        fileRefs.current.forEach((node, link) => {
            if (node) {
                const nodeLeft = node.offsetLeft;
                const nodeTop = node.offsetTop;
                const nodeRight = nodeLeft + node.offsetWidth;
                const nodeBottom = nodeTop + node.offsetHeight;

                const isIntersecting = !(
                    boxLeft > nodeRight ||
                    boxRight < nodeLeft ||
                    boxTop > nodeBottom ||
                    boxBottom < nodeTop
                );

                if (isIntersecting) {
                    newSelectedIds.add(link);
                }
            }
        });

        setSelectedIds(Array.from(newSelectedIds));
    }, [containerRef, contentRef, fileRefs]);

    // Global mouse handlers
    useEffect(() => {
        if (!isOpen) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            lastMousePos.current = { x: e.clientX, y: e.clientY };

            // Auto-scroll logic
            if (containerRef.current) {
                const { top, bottom } = containerRef.current.getBoundingClientRect();
                const threshold = 50;
                const speed = 15;

                if (e.clientY < top + threshold) {
                    if (!autoScrollInterval.current) {
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current && containerRef.current.scrollTop > 0) {
                                containerRef.current.scrollTop -= speed;
                                if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y);
                            }
                        }, 16);
                    }
                } else if (e.clientY > bottom - threshold) {
                    if (!autoScrollInterval.current) {
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current) {
                                containerRef.current.scrollTop += speed;
                                if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y);
                            }
                        }, 16);
                    }
                } else {
                    if (autoScrollInterval.current) {
                        clearInterval(autoScrollInterval.current);
                        autoScrollInterval.current = null;
                    }
                }
            }

            // Drag detection threshold
            if (!isDraggingRef.current && selectionStartRef.current && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current.scrollLeft;
                const y = e.clientY - rect.top + containerRef.current.scrollTop;
                
                const dx = x - selectionStartRef.current.x;
                const dy = y - selectionStartRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 5) {
                    isDraggingRef.current = true;
                    setIsDragging(true);
                }
            }

            if (isDraggingRef.current) {
                processSelection(e.clientX, e.clientY);
            }
        };

        const handleGlobalMouseUp = () => {
            if (autoScrollInterval.current) {
                clearInterval(autoScrollInterval.current);
                autoScrollInterval.current = null;
            }

            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);

            if (isDraggingRef.current) {
                ignoreClickRef.current = true;
                setTimeout(() => { ignoreClickRef.current = false; }, 100);
                setIsDragging(false);
                isDraggingRef.current = false;
            }
            setSelectionStart(null);
            setSelectionEnd(null);
            selectionStartRef.current = null;
        };

        if (selectionStart) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            if (autoScrollInterval.current) clearInterval(autoScrollInterval.current);
        };
    }, [isOpen, selectionStart, processSelection, containerRef]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.interactive') || target.tagName === 'BUTTON' || target.tagName === 'A') return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const y = e.clientY - rect.top + containerRef.current.scrollTop;

            setSelectionStart({ x, y });
            setSelectionEnd({ x, y });
            selectionStartRef.current = { x, y };
            
            initialSelectedIds.current = (e.ctrlKey || e.shiftKey || e.metaKey) ? selectedIds : [];
            if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                setSelectedIds([]);
            }
        }
    }, [containerRef, selectedIds]);

    const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    // Calculate selection box style
    const selectionBoxStyle = useMemo(() => {
        if (!selectionStart || !selectionEnd) return null;
        
        const left = Math.min(selectionStart.x, selectionEnd.x);
        const top = Math.min(selectionStart.y, selectionEnd.y);
        const width = Math.abs(selectionEnd.x - selectionStart.x);
        const height = Math.abs(selectionEnd.y - selectionStart.y);

        return { left, top, width, height };
    }, [selectionStart, selectionEnd]);

    return {
        selectedIds,
        isDragging,
        selectionBoxStyle,
        ignoreClickRef,
        handleMouseDown,
        toggleSelect,
        clearSelection,
        setSelectedIds
    };
}
