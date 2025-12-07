/**
 * useDragSelection - A hook for implementing drag-to-select functionality.
 * 
 * This hook manages state and event handlers for selecting items by
 * clicking and dragging across a container. It supports:
 * - Click-to-toggle individual items
 * - Drag to select multiple items
 * - Auto-scroll when dragging near container edges
 * - Threshold to differentiate click from drag
 */

import { useRef, useState, useCallback, useEffect } from 'react';

interface Position {
    x: number;
    y: number;
}

interface UseDragSelectionOptions {
    /** Callback when an item is clicked (not dragged) */
    onItemClick?: (itemId: string) => void;
    /** Threshold in pixels before drag starts (default: 5) */
    dragThreshold?: number;
    /** Auto-scroll speed in pixels per frame (default: 10) */
    scrollSpeed?: number;
    /** Auto-scroll zone threshold from edge (default: 50) */
    scrollThreshold?: number;
    /** Delay before auto-scroll starts in ms (default: 300) */
    scrollDelay?: number;
}

interface UseDragSelectionReturn {
    /** Currently selected item IDs */
    selectedIds: string[];
    /** Set selected IDs directly */
    setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
    /** Whether currently dragging */
    isDragging: boolean;
    /** Selection box start position (relative to container content) */
    selectionStart: Position | null;
    /** Selection box end position (relative to container content) */
    selectionEnd: Position | null;
    /** Ref for the scrollable container */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** Ref for the content inside container (for measuring) */
    contentRef: React.RefObject<HTMLDivElement | null>;
    /** Map to register selectable item refs */
    itemRefs: React.MutableRefObject<Map<string, HTMLElement>>;
    /** Handler to attach to container's onMouseDown */
    handleMouseDown: (e: React.MouseEvent) => void;
    /** Handler for backdrop clicks (closes on click outside items) */
    handleBackdropClick: (e: React.MouseEvent, onClose: () => void) => void;
    /** Toggle selection of a single item */
    toggleSelection: (itemId: string) => void;
    /** Select all or deselect all visible items */
    handleSelectAll: (visibleIds: string[]) => void;
    /** Clear all selections */
    clearSelection: () => void;
}

export function useDragSelection(options: UseDragSelectionOptions = {}): UseDragSelectionReturn {
    const {
        onItemClick,
        dragThreshold = 5,
        scrollSpeed = 10,
        scrollThreshold = 50,
        scrollDelay = 300,
    } = options;

    // State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<Position | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<Position | null>(null);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

    // Internal refs for event handlers
    const isDraggingRef = useRef(false);
    const selectionStartRef = useRef<Position | null>(null);
    const initialSelectedIds = useRef<string[]>([]);
    const lastMousePos = useRef<Position | null>(null);
    const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);
    const autoScrollDelayTimeout = useRef<NodeJS.Timeout | null>(null);
    const ignoreClickRef = useRef(false);

    // Process selection based on current mouse position
    const processSelection = useCallback((clientX: number, clientY: number) => {
        if (!selectionStartRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left + containerRef.current.scrollLeft;
        const y = clientY - rect.top + containerRef.current.scrollTop;

        // Clamp to content boundaries
        const contentWidth = contentRef.current?.scrollWidth ?? containerRef.current.scrollWidth;
        const contentHeight = contentRef.current?.scrollHeight ?? containerRef.current.scrollHeight;
        const clampedX = Math.max(0, Math.min(x, contentWidth));
        const clampedY = Math.max(0, Math.min(y, contentHeight));

        setSelectionEnd({ x: clampedX, y: clampedY });

        // Calculate selection box
        const boxLeft = Math.min(selectionStartRef.current.x, clampedX);
        const boxTop = Math.min(selectionStartRef.current.y, clampedY);
        const boxRight = Math.max(selectionStartRef.current.x, clampedX);
        const boxBottom = Math.max(selectionStartRef.current.y, clampedY);

        // Find intersecting items
        const newSelectedIds = new Set(initialSelectedIds.current);
        itemRefs.current.forEach((node, itemId) => {
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
                    newSelectedIds.add(itemId);
                }
            }
        });

        setSelectedIds(Array.from(newSelectedIds));
    }, []);

    // Clear auto-scroll timers
    const clearAutoScroll = useCallback(() => {
        if (autoScrollInterval.current) {
            clearInterval(autoScrollInterval.current);
            autoScrollInterval.current = null;
        }
        if (autoScrollDelayTimeout.current) {
            clearTimeout(autoScrollDelayTimeout.current);
            autoScrollDelayTimeout.current = null;
        }
    }, []);

    // Global mouse move handler
    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        lastMousePos.current = { x: e.clientX, y: e.clientY };

        // Auto-scroll logic
        if (containerRef.current && isDraggingRef.current) {
            const { top, bottom } = containerRef.current.getBoundingClientRect();

            if (e.clientY < top + scrollThreshold) {
                // Near top - scroll up
                if (!autoScrollInterval.current && !autoScrollDelayTimeout.current) {
                    autoScrollDelayTimeout.current = setTimeout(() => {
                        autoScrollDelayTimeout.current = null;
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current && containerRef.current.scrollTop > 0) {
                                containerRef.current.scrollTop -= scrollSpeed;
                                if (lastMousePos.current) {
                                    processSelection(lastMousePos.current.x, lastMousePos.current.y);
                                }
                            } else {
                                clearAutoScroll();
                            }
                        }, 16);
                    }, scrollDelay);
                }
            } else if (e.clientY > bottom - scrollThreshold) {
                // Near bottom - scroll down
                if (!autoScrollInterval.current && !autoScrollDelayTimeout.current) {
                    autoScrollDelayTimeout.current = setTimeout(() => {
                        autoScrollDelayTimeout.current = null;
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current) {
                                const maxScroll = containerRef.current.scrollHeight - containerRef.current.clientHeight;
                                if (containerRef.current.scrollTop < maxScroll - 1) {
                                    containerRef.current.scrollTop += scrollSpeed;
                                    if (lastMousePos.current) {
                                        processSelection(lastMousePos.current.x, lastMousePos.current.y);
                                    }
                                } else {
                                    clearAutoScroll();
                                }
                            }
                        }, 16);
                    }, scrollDelay);
                }
            } else {
                clearAutoScroll();
            }
        }

        // Check if we've exceeded drag threshold
        if (!isDraggingRef.current && selectionStartRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const y = e.clientY - rect.top + containerRef.current.scrollTop;
            const dx = x - selectionStartRef.current.x;
            const dy = y - selectionStartRef.current.y;

            if (Math.sqrt(dx * dx + dy * dy) >= dragThreshold) {
                isDraggingRef.current = true;
                setIsDragging(true);
            }
        }

        if (isDraggingRef.current) {
            processSelection(e.clientX, e.clientY);
        }
    }, [dragThreshold, scrollThreshold, scrollSpeed, scrollDelay, processSelection, clearAutoScroll]);

    // Use ref to avoid circular dependency in handleGlobalMouseUp
    const handleGlobalMouseUpRef = useRef<() => void>(() => { });

    // Update ref in effect to satisfy eslint refs rule
    useEffect(() => {
        handleGlobalMouseUpRef.current = () => {
            clearAutoScroll();
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUpRef.current);

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
    }, [clearAutoScroll, handleGlobalMouseMove]);

    // Container mouse down handler
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Only handle left click
        if (e.button !== 0) return;

        // Ignore if clicking on interactive elements
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, [data-no-drag]')) return;

        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left + containerRef.current.scrollLeft;
        const y = e.clientY - rect.top + containerRef.current.scrollTop;

        selectionStartRef.current = { x, y };
        setSelectionStart({ x, y });
        initialSelectedIds.current = [...selectedIds];

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUpRef.current);
    }, [selectedIds, handleGlobalMouseMove]);

    // Handle backdrop click
    const handleBackdropClick = useCallback((e: React.MouseEvent, onClose: () => void) => {
        if (ignoreClickRef.current) return;
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, []);

    // Toggle single item selection
    const toggleSelection = useCallback((itemId: string) => {
        if (onItemClick) {
            onItemClick(itemId);
            return;
        }
        setSelectedIds(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    }, [onItemClick]);

    // Select/deselect all visible items
    const handleSelectAll = useCallback((visibleIds: string[]) => {
        const allVisible = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
        if (allVisible) {
            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    }, [selectedIds]);

    // Clear all selections
    const clearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAutoScroll();
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUpRef.current);
        };
    }, [clearAutoScroll, handleGlobalMouseMove]);

    return {
        selectedIds,
        setSelectedIds,
        isDragging,
        selectionStart,
        selectionEnd,
        containerRef,
        contentRef,
        itemRefs,
        handleMouseDown,
        handleBackdropClick,
        toggleSelection,
        handleSelectAll,
        clearSelection,
    };
}
