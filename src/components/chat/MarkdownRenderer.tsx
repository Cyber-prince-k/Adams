/**
 * MarkdownRenderer
 *
 * Lightweight markdown-to-React-Native renderer.
 * Handles: paragraphs, headings, bold, italic, inline code,
 *          code blocks (syntax-highlighted on web), bullet lists,
 *          numbered lists, blockquotes, horizontal rules.
 *
 * Uses mdast-util-from-markdown for AST parsing, then walks the tree.
 * Syntax highlighting uses react-syntax-highlighter (web only — native
 * falls back to a styled monospace block to avoid bundle bloat).
 */

import React from "react";
import { Text, View, StyleSheet, Platform, ScrollView } from "react-native";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Root, Content, InlineCode, Code, Paragraph, Heading,
               Strong, Emphasis, List, ListItem, Blockquote, Text as MdText,
               ThematicBreak } from "mdast";

// Lazy-load SyntaxHighlighter on web only
let SyntaxHighlighter: React.ComponentType<{
  language?: string;
  style?: Record<string, unknown>;
  children: string;
}> | null = null;

if (Platform.OS === "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("react-syntax-highlighter");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { atomOneDark } = require("react-syntax-highlighter/dist/esm/styles/hljs");
    const Comp = pkg.default ?? pkg.Light;
    SyntaxHighlighter = (props: { language?: string; children: string }) => (
      <Comp style={atomOneDark} language={props.language ?? "text"}>
        {props.children}
      </Comp>
    );
  } catch {
    // will fall through to plain code block
  }
}

// ─── Walk the AST ─────────────────────────────────────────────────────────────

function renderNode(node: Content | Root, key: string | number): React.ReactNode {
  switch (node.type) {
    case "root":
      return (
        <View key={key}>
          {(node as Root).children.map((child, i) => renderNode(child, i))}
        </View>
      );

    case "paragraph":
      return (
        <Text key={key} style={styles.paragraph}>
          {(node as Paragraph).children.map((child, i) =>
            renderInline(child as Content, `${key}-${i}`)
          )}
        </Text>
      );

    case "heading": {
      const h = node as Heading;
      const headingStyle = [styles.heading, styles[`h${h.depth as 1|2|3|4|5|6}`]];
      return (
        <Text key={key} style={headingStyle}>
          {h.children.map((c, i) => renderInline(c as Content, `${key}-${i}`))}
        </Text>
      );
    }

    case "code": {
      const c = node as Code;
      if (Platform.OS === "web" && SyntaxHighlighter) {
        return (
          <View key={key} style={styles.codeBlock}>
            {c.lang && <Text style={styles.codeLang}>{c.lang}</Text>}
            <SyntaxHighlighter language={c.lang ?? "text"}>
              {c.value}
            </SyntaxHighlighter>
          </View>
        );
      }
      return (
        <ScrollView key={key} horizontal style={styles.codeBlock}>
          <Text style={styles.codeBlockText}>{c.value}</Text>
        </ScrollView>
      );
    }

    case "list": {
      const l = node as List;
      return (
        <View key={key} style={styles.list}>
          {l.children.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>
                {l.ordered ? `${i + 1}.` : "•"}
              </Text>
              <View style={styles.listContent}>
                {(item as ListItem).children.map((c, j) =>
                  renderNode(c as Content, `${key}-${i}-${j}`)
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case "blockquote":
      return (
        <View key={key} style={styles.blockquote}>
          {(node as Blockquote).children.map((c, i) =>
            renderNode(c as Content, `${key}-${i}`)
          )}
        </View>
      );

    case "thematicBreak":
      return <View key={key} style={styles.hr} />;

    default:
      // Fallback: try to render as inline
      return renderInline(node as Content, key);
  }
}

function renderInline(node: Content, key: string | number): React.ReactNode {
  switch (node.type) {
    case "text":
      return <Text key={key}>{(node as MdText).value}</Text>;

    case "strong":
      return (
        <Text key={key} style={styles.bold}>
          {(node as Strong).children.map((c, i) =>
            renderInline(c as Content, `${key}-${i}`)
          )}
        </Text>
      );

    case "emphasis":
      return (
        <Text key={key} style={styles.italic}>
          {(node as Emphasis).children.map((c, i) =>
            renderInline(c as Content, `${key}-${i}`)
          )}
        </Text>
      );

    case "inlineCode":
      return (
        <Text key={key} style={styles.inlineCode}>
          {(node as InlineCode).value}
        </Text>
      );

    case "softBreak":
    case "break":
      return <Text key={key}>{"\n"}</Text>;

    default:
      return null;
  }
}

// ─── Public component ─────────────────────────────────────────────────────────

interface Props {
  content: string;
}

export function MarkdownRenderer({ content }: Props) {
  const ast = React.useMemo(() => {
    try {
      return fromMarkdown(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!ast) {
    return <Text style={styles.paragraph}>{content}</Text>;
  }

  return <View>{renderNode(ast, "root")}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CODE_BG = "#0d1117";
const CODE_FG = "#c9d1d9";

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 15,
    color: "#e8e8f0",
    lineHeight: 22,
    marginBottom: 8,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  heading: {
    color: "#f0f0fa",
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 6,
    ...(Platform.OS === "web" ? { fontFamily: "system-ui, sans-serif" } as object : {}),
  },
  h1: { fontSize: 24 },
  h2: { fontSize: 20 },
  h3: { fontSize: 17 },
  h4: { fontSize: 15 },
  h5: { fontSize: 14 },
  h6: { fontSize: 13 },

  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },

  inlineCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "JetBrains Mono, Fira Code, monospace",
    fontSize: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#79c0ff",
    paddingHorizontal: 4,
    borderRadius: 3,
  },

  codeBlock: {
    backgroundColor: CODE_BG,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  codeLang: {
    fontSize: 11,
    color: "#6b6b80",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codeBlockText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "JetBrains Mono, monospace",
    fontSize: 13,
    color: CODE_FG,
    lineHeight: 20,
  },

  list: {
    marginVertical: 6,
    gap: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    color: "#3b82f6",
    lineHeight: 22,
    minWidth: 18,
  },
  listContent: {
    flex: 1,
  },

  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    paddingLeft: 12,
    marginVertical: 8,
    opacity: 0.8,
  },

  hr: {
    height: 1,
    backgroundColor: "#2a2a3a",
    marginVertical: 12,
  },
});
