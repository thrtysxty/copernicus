// Electron <webview> JSX type — not in @types/react
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean | string
        nodeintegration?: boolean | string
        webpreferences?: string
        ref?: React.Ref<any>
      },
      HTMLElement
    >
  }
}
