import React from 'react';
import ReactMarkdown from 'react-markdown';
import { StudyReference } from './StudyReference';

interface MarkdownWithStudyRefsProps {
  content: string;
  onStudyHover: (studyNumber: number | null) => void;
}

export const MarkdownWithStudyRefs = ({ content, onStudyHover }: MarkdownWithStudyRefsProps) => {
  const processText = (text: string): (string | React.ReactElement)[] => {
    const studyPattern = /Study #(\d+)/gi;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = studyPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const studyNumber = parseInt(match[1]!, 10);
      parts.push(
        <StudyReference
          key={`study-ref-${match.index}-${studyNumber}`}
          studyNumber={studyNumber}
          onHover={onStudyHover}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processText(child);
            }
            return child;
          });
          return <p>{processedChildren}</p>;
        },
        li: ({ children }) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processText(child);
            }
            return child;
          });
          return <li>{processedChildren}</li>;
        },
        strong: ({ children }) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processText(child);
            }
            return child;
          });
          return <strong>{processedChildren}</strong>;
        },
        em: ({ children }) => {
          const processedChildren = React.Children.map(children, (child) => {
            if (typeof child === 'string') {
              return processText(child);
            }
            return child;
          });
          return <em>{processedChildren}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
