import React from 'react';
import { diffLines, Change } from 'diff';

export function computeConfigDiff(oldConfig: string, newConfig: string): Change[] {
  return diffLines(oldConfig, newConfig);
}

interface DiffViewProps {
  oldValue: string;
  newValue: string;
  showLineNumbers?: boolean;
  splitView?: boolean;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineNumber: number;
}

export default function DiffView({
  oldValue,
  newValue,
  showLineNumbers = true,
  splitView = false,
}: DiffViewProps) {
  const diff = diffLines(oldValue, newValue);

  const renderDiff = () => {
    let oldLineNum = 0;
    let newLineNum = 0;

    return diff.map((part: Change, index: number) => {
      const lines = part.value.split('\n');
      // Remove trailing empty line from split
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      return lines.map((line, lineIndex) => {
        if (part.added) {
          newLineNum++;
          return (
            <div
              key={`${index}-${lineIndex}`}
              className="flex bg-green-500/10"
            >
              {showLineNumbers && (
                <span className="w-12 shrink-0 text-right pr-3 text-xs text-green-500/60 select-none">
                  +{newLineNum}
                </span>
              )}
              <span className="flex-1 text-green-400 font-mono text-xs whitespace-pre-wrap break-all">
                + {line}
              </span>
            </div>
          );
        } else if (part.removed) {
          oldLineNum++;
          return (
            <div
              key={`${index}-${lineIndex}`}
              className="flex bg-red-500/10"
            >
              {showLineNumbers && (
                <span className="w-12 shrink-0 text-right pr-3 text-xs text-red-500/60 select-none">
                  -{oldLineNum}
                </span>
              )}
              <span className="flex-1 text-red-400 font-mono text-xs whitespace-pre-wrap break-all">
                - {line}
              </span>
            </div>
          );
        } else {
          oldLineNum++;
          newLineNum++;
          return (
            <div
              key={`${index}-${lineIndex}`}
              className="flex"
            >
              {showLineNumbers && (
                <span className="w-12 shrink-0 text-right pr-3 text-xs text-text-faint select-none">
                  {oldLineNum}
                </span>
              )}
              <span className="flex-1 text-text-secondary font-mono text-xs whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          );
        }
      });
    });
  };

  if (splitView) {
    // Split view implementation
    const oldLines: React.ReactElement[] = [];
    const newLines: React.ReactElement[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;

    diff.forEach((part: Change, index: number) => {
      const lines = part.value.split('\n');
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      lines.forEach((line, lineIndex) => {
        const key = `${index}-${lineIndex}`;
        if (part.added) {
          newLineNum++;
          newLines.push(
            <div key={key} className="bg-green-500/10 px-2 py-0.5">
              <span className="text-green-400 font-mono text-xs whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          );
          oldLines.push(<div key={key} className="px-2 py-0.5 text-text-faint text-xs">...</div>);
        } else if (part.removed) {
          oldLineNum++;
          oldLines.push(
            <div key={key} className="bg-red-500/10 px-2 py-0.5">
              <span className="text-red-400 font-mono text-xs whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          );
          newLines.push(<div key={key} className="px-2 py-0.5 text-text-faint text-xs">...</div>);
        } else {
          oldLineNum++;
          newLineNum++;
          oldLines.push(
            <div key={key} className="px-2 py-0.5">
              <span className="text-text-secondary font-mono text-xs whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          );
          newLines.push(
            <div key={key} className="px-2 py-0.5">
              <span className="text-text-secondary font-mono text-xs whitespace-pre-wrap break-all">
                {line}
              </span>
            </div>
          );
        }
      });
    });

    return (
      <div className="flex gap-1 overflow-x-auto">
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="bg-bg-tertiary px-3 py-1.5 text-xs text-text-muted border-b border-border">
            旧版本
          </div>
          <div className="p-2">{oldLines}</div>
        </div>
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="bg-bg-tertiary px-3 py-1.5 text-xs text-text-muted border-b border-border">
            新版本
          </div>
          <div className="p-2">{newLines}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-primary">
      <div className="p-2 overflow-x-auto">
        {renderDiff()}
      </div>
    </div>
  );
}
