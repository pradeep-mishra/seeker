import { useCallback, useEffect, useRef, useState } from "react";
import type { FileItem } from "./api";

interface UseLassoSelectionProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  files: FileItem[];
  clearSelection: () => void;
  selectAll: (items: FileItem[]) => void;
}

interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useLassoSelection({
  containerRef,
  files,
  clearSelection,
  selectAll
}: UseLassoSelectionProps) {
  const filesRef = useRef(files);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    scrollX: number;
    scrollY: number;
  } | null>(null);
  const isDraggingRef = useRef(false);
  const lassoSelectedPathsRef = useRef<Set<string>>(new Set());
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  // Update files ref when files change
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Handle lasso selection
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragStartRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Get current mouse position in document space (relative to container + scroll offset)
      const currentDocX = e.clientX - containerRect.left + container.scrollLeft;
      const currentDocY = e.clientY - containerRect.top + container.scrollTop;

      const startDocX = dragStartRef.current.x;
      const startDocY = dragStartRef.current.y;

      // Minimum drag distance to start selecting (in viewport space for UX)
      if (
        !isDraggingRef.current &&
        (Math.abs(
          e.clientX -
            (startDocX - dragStartRef.current.scrollX + containerRect.left)
        ) > 5 ||
          Math.abs(
            e.clientY -
              (startDocY - dragStartRef.current.scrollY + containerRect.top)
          ) > 5)
      ) {
        isDraggingRef.current = true;
        clearSelection();
        lassoSelectedPathsRef.current.clear();
      }

      if (isDraggingRef.current) {
        // Calculate lasso box in document space
        const docBoxLeft = Math.min(startDocX, currentDocX);
        const docBoxTop = Math.min(startDocY, currentDocY);
        const docBoxRight = Math.max(startDocX, currentDocX);
        const docBoxBottom = Math.max(startDocY, currentDocY);

        // Convert to viewport coordinates for visual display
        const viewportX =
          docBoxLeft - container.scrollLeft + containerRect.left;
        const viewportY = docBoxTop - container.scrollTop + containerRect.top;
        const width = docBoxRight - docBoxLeft;
        const height = docBoxBottom - docBoxTop;

        setSelectionBox({
          x: viewportX,
          y: viewportY,
          width,
          height
        });

        // Check all file elements for intersection
        const elements = container.querySelectorAll("[data-path]");

        elements.forEach((el) => {
          const path = el.getAttribute("data-path");
          if (!path) return;

          const rect = el.getBoundingClientRect();

          // Convert element position to document space
          const elemDocLeft =
            rect.left - containerRect.left + container.scrollLeft;
          const elemDocTop = rect.top - containerRect.top + container.scrollTop;
          const elemDocRight = elemDocLeft + rect.width;
          const elemDocBottom = elemDocTop + rect.height;

          // Check intersection in document space
          const isIntersecting =
            elemDocLeft < docBoxRight &&
            elemDocRight > docBoxLeft &&
            elemDocTop < docBoxBottom &&
            elemDocBottom > docBoxTop;

          if (isIntersecting) {
            // Add to selection
            lassoSelectedPathsRef.current.add(path);
          } else {
            // Remove from selection (lasso retracted)
            lassoSelectedPathsRef.current.delete(path);
          }
        });

        // Build final selection from accumulated paths
        const selectedItems: FileItem[] = [];
        lassoSelectedPathsRef.current.forEach((path) => {
          const item = filesRef.current.find((f) => f.path === path);
          if (item) selectedItems.push(item);
        });

        selectAll(selectedItems);
      }
    },
    [containerRef, clearSelection, selectAll]
  );

  const handleMouseUp = useCallback(() => {
    // If we finished a click without dragging, clear selection
    if (!isDraggingRef.current && dragStartRef.current) {
      clearSelection();
    }

    dragStartRef.current = null;
    setSelectionBox(null);
    lassoSelectedPathsRef.current.clear();
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, [handleMouseMove, clearSelection]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ignore if clicking on a file item or if right button
      if (e.button !== 0) return;

      // Check if we clicked on a file item
      if ((e.target as Element).closest("[data-path]")) return;

      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Store initial position in document space
      const docX = e.clientX - containerRect.left + container.scrollLeft;
      const docY = e.clientY - containerRect.top + container.scrollTop;

      dragStartRef.current = {
        x: docX,
        y: docY,
        scrollX: container.scrollLeft,
        scrollY: container.scrollTop
      };
      isDraggingRef.current = false;

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [containerRef, handleMouseMove, handleMouseUp]
  );

  // Handle Escape key to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        clearSelection();
        setSelectionBox(null);
        dragStartRef.current = null;
        isDraggingRef.current = false;
        lassoSelectedPathsRef.current.clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection]);

  return {
    selectionBox,
    handleMouseDown,
    isDragging: () => isDraggingRef.current
  };
}
