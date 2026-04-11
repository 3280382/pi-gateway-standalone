declare module "react-syntax-highlighter" {
  import { ComponentType, ReactNode } from "react";

  export interface SyntaxHighlighterProps {
    language: string;
    style?: any;
    children?: ReactNode;
    [key: string]: any;
  }

  const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus" {
  const style: any;
  export default style;
}
