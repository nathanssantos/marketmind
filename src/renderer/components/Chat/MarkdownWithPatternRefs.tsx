import { usePatterns } from '@renderer/hooks/usePatterns';
import { useAIStore } from '@renderer/store/aiStore';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { PatternReference } from './PatternReference';

interface MarkdownWithPatternRefsProps {
  content: string;
  onPatternHover: (patternNumber: number | null) => void;
}

export const MarkdownWithPatternRefs = ({ content, onPatternHover }: MarkdownWithPatternRefsProps) => {
  const { activeConversationId } = useAIStore();
  const { patterns } = usePatterns({
    symbol: activeConversationId || 'default',
    conversationId: activeConversationId || null
  });

  const patternsMap = useMemo(() => {
    return new Map(patterns.map(s => [s.id, s]));
  }, [patterns]);
  const processText = (text: string): (string | React.ReactElement)[] => {
    const patternPattern = /#(\d+)/g;
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = patternPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const patternNumber = parseInt(match[1]!, 10);
      const pattern = patternsMap.get(patternNumber);

      parts.push(
        <PatternReference
          key={`pattern-ref-${match.index}-${patternNumber}`}
          patternNumber={patternNumber}
          pattern={pattern}
          onHover={onPatternHover}
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
