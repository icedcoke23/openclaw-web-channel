import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { CanvasData, CanvasElement } from '@/types';

interface CanvasRendererProps {
  data: CanvasData;
  sessionId?: string;
  editable?: boolean;
  onUpdate?: (data: CanvasData) => void;
}

interface CanvasElementProps {
  element: CanvasElement;
  isSelected?: boolean;
  onSelect?: () => void;
  editable?: boolean;
  onChange?: (element: CanvasElement) => void;
}

function CanvasElementRenderer({ element, isSelected, onSelect, editable, onChange }: CanvasElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(element.content || '');

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    cursor: editable ? 'move' : 'default',
    outline: isSelected ? '2px solid #3b82f6' : 'none',
    outlineOffset: '2px',
  };

  const handleDoubleClick = () => {
    if (editable && element.type === 'text') {
      setIsEditing(true);
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (onChange && text !== element.content) {
      onChange({ ...element, content: text });
    }
  };

  switch (element.type) {
    case 'rectangle':
      return (
        <div
          style={{
            ...baseStyle,
            width: element.width || 100,
            height: element.height || 100,
            backgroundColor: element.fill || '#e5e7eb',
            border: `${element.strokeWidth || 2}px solid ${element.stroke || '#374151'}`,
            borderRadius: '4px',
          }}
          onClick={onSelect}
          onDoubleClick={handleDoubleClick}
        />
      );

    case 'circle':
      return (
        <div
          style={{
            ...baseStyle,
            width: element.width || 100,
            height: element.height || 100,
            backgroundColor: element.fill || '#e5e7eb',
            border: `${element.strokeWidth || 2}px solid ${element.stroke || '#374151'}`,
            borderRadius: '50%',
          }}
          onClick={onSelect}
        />
      );

    case 'line':
      return (
        <svg
          style={{ ...baseStyle, width: element.width || 100, height: element.height || 20, overflow: 'visible' }}
          onClick={onSelect}
        >
          <line
            x1="0"
            y1={element.height ? element.height / 2 : 10}
            x2={element.width || 100}
            y2={element.height ? element.height / 2 : 10}
            stroke={element.stroke || '#374151'}
            strokeWidth={element.strokeWidth || 2}
          />
        </svg>
      );

    case 'text':
      return (
        <div
          style={{
            ...baseStyle,
            minWidth: '50px',
            minHeight: '24px',
            color: element.stroke || '#374151',
            fontSize: '16px',
            fontFamily: 'inherit',
          }}
          onClick={onSelect}
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={handleTextBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTextBlur()}
              autoFocus
              className="bg-transparent outline-none w-full"
              style={{ color: element.stroke || '#374151' }}
            />
          ) : (
            element.content || '双击编辑'
          )}
        </div>
      );

    case 'image':
      return (
        <div
          style={{
            ...baseStyle,
            width: element.width || 200,
            height: element.height || 150,
            overflow: 'hidden',
            borderRadius: '4px',
          }}
          onClick={onSelect}
        >
          {element.src && (
            <img
              src={element.src}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              draggable={false}
            />
          )}
        </div>
      );

    case 'path':
      if (!element.points || element.points.length === 0) return null;
      const pathData = element.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - element.x} ${p.y - element.y}`)
        .join(' ');
      return (
        <svg
          style={{
            ...baseStyle,
            width: element.width || 100,
            height: element.height || 100,
            overflow: 'visible',
          }}
          onClick={onSelect}
        >
          <path
            d={pathData}
            fill="none"
            stroke={element.stroke || '#374151'}
            strokeWidth={element.strokeWidth || 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return null;
  }
}

export default function CanvasRenderer({ data, sessionId, editable = false, onUpdate }: CanvasRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>(data.elements || []);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setElements(data.elements || []);
  }, [data.elements]);

  const handleElementSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleElementChange = useCallback(
    (updatedElement: CanvasElement) => {
      const newElements = elements.map((el) => (el.id === updatedElement.id ? updatedElement : el));
      setElements(newElements);
      if (onUpdate) {
        onUpdate({ ...data, elements: newElements });
      }
    },
    [elements, data, onUpdate]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!editable || !selectedId) return;

      const element = elements.find((el) => el.id === selectedId);
      if (!element) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - element.x - rect.left,
        y: e.clientY - element.y - rect.top,
      });
    },
    [editable, selectedId, elements]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !selectedId || !editable) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const newX = e.clientX - dragOffset.x - rect.left;
      const newY = e.clientY - dragOffset.y - rect.top;

      handleElementChange({
        ...elements.find((el) => el.id === selectedId)!,
        x: Math.max(0, newX),
        y: Math.max(0, newY),
      });
    },
    [isDragging, selectedId, dragOffset, elements, editable, handleElementChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!editable || !selectedId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const newElements = elements.filter((el) => el.id !== selectedId);
        setElements(newElements);
        setSelectedId(null);
        if (onUpdate) {
          onUpdate({ ...data, elements: newElements });
        }
      }
    },
    [editable, selectedId, elements, data, onUpdate]
  );

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-lg border border-border ${editable ? 'select-none' : ''}`}
      style={{
        width: data.width || 800,
        height: data.height || 600,
        backgroundColor: data.background || '#ffffff',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      tabIndex={editable ? 0 : undefined}
    >
      {elements.map((element) => (
        <CanvasElementRenderer
          key={element.id}
          element={element}
          isSelected={element.id === selectedId}
          onSelect={() => handleElementSelect(element.id)}
          editable={editable}
          onChange={handleElementChange}
        />
      ))}
      {elements.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-faint text-sm">
          {editable ? '点击添加元素' : '画布为空'}
        </div>
      )}
    </div>
  );
}

// Canvas message detector and renderer
export function CanvasMessageRenderer({ content }: { content: string }) {
  // Try to detect canvas data in the message
  let canvasData: CanvasData | null = null;

  try {
    // Look for canvas JSON in the content
    const canvasMatch = content.match(/```canvas\n([\s\S]*?)\n```|:::canvas\n([\s\S]*?)\n:::/);
    if (canvasMatch) {
      const jsonStr = canvasMatch[1] || canvasMatch[2];
      canvasData = JSON.parse(jsonStr);
    }
  } catch {
    // Not a canvas message
  }

  if (!canvasData) {
    return null;
  }

  return (
    <div className="my-2">
      <CanvasRenderer data={canvasData} />
    </div>
  );
}
