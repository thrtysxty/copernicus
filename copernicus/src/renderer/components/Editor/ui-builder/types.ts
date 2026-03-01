export type UIComponentType =
  | 'container' | 'row' | 'column'
  | 'heading' | 'paragraph' | 'label'
  | 'button' | 'input' | 'textarea' | 'select'
  | 'image' | 'icon' | 'divider' | 'spacer'
  | 'badge' | 'alert' | 'card'

export interface UIComponent {
  id: string
  type: UIComponentType
  label: string            // display name in canvas
  props: UIComponentProps
  children: UIComponent[]
  x?: number               // top-level only — position on canvas
  y?: number
  w?: number               // width in px (top-level)
  h?: number               // height in px (top-level)
}

export interface UIComponentProps {
  text?: string            // heading, paragraph, button, label, badge
  placeholder?: string     // input, textarea
  src?: string             // image
  href?: string            // button (link variant)
  variant?: string         // button: 'primary'|'secondary'|'ghost'|'danger'
  size?: 'sm' | 'md' | 'lg'
  color?: string           // Tailwind color name or hex
  bgColor?: string
  borderColor?: string
  rounded?: boolean
  shadow?: boolean
  padding?: string         // Tailwind padding class e.g. 'p-4'
  gap?: string             // Tailwind gap class e.g. 'gap-3'
  align?: 'left' | 'center' | 'right'
  extraClasses?: string    // escape hatch for arbitrary Tailwind
}
