import { useAIStudies } from '@renderer/hooks/useAIStudies';
import { useAIStore } from '@renderer/store/aiStore';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { StudyReference } from './StudyReference';

interface MarkdownWithStudyRefsProps {
  content: string;
  onStudyHover: (studyNumber: number | null) => void;
}

export const MarkdownWithStudyRefs = ({ content, onStudyHover }: MarkdownWithStudyRefsProps) => {
  const { activeConversationId } = useAIStore();
  const { studies } = useAIStudies({ 
    symbol: activeConversationId || 'default',
    conversationId: activeConversationId || null 
  });

  const studiesMap = useMemo(() => {
    return new Map(studies.map(s => [s.id, s]));
  }, [studies]);
  const processText = (text: string): (string | React.ReactElement)[] => {
    const studyPattern = /#(\d+)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = studyPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const studyNumber = parseInt(match[1]!, 10);
      const study = studiesMap.get(studyNumber);
      const studyRef = study ? { study } : {};
      parts.push(
        <StudyReference
          key={`study-ref-${match.index}-${studyNumber}`}
          studyNumber={studyNumber}
          {...studyRef}
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

  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') {
        return processText(child);
      }
      return child;
    });
  };

  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p>{processChildren(children)}</p>,
        li: ({ children }) => <li>{processChildren(children)}</li>,
        strong: ({ children }) => <strong>{processChildren(children)}</strong>,
        em: ({ children }) => <em>{processChildren(children)}</em>,
        h1: ({ children }) => <h1>{processChildren(children)}</h1>,
        h2: ({ children }) => <h2>{processChildren(children)}</h2>,
        h3: ({ children }) => <h3>{processChildren(children)}</h3>,
        h4: ({ children }) => <h4>{processChildren(children)}</h4>,
        h5: ({ children }) => <h5>{processChildren(children)}</h5>,
        h6: ({ children }) => <h6>{processChildren(children)}</h6>,
        blockquote: ({ children }) => <blockquote>{processChildren(children)}</blockquote>,
        code: ({ children }) => <code>{processChildren(children)}</code>,
        td: ({ children }) => <td>{processChildren(children)}</td>,
        th: ({ children }) => <th>{processChildren(children)}</th>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
};
