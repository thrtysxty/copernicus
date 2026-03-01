import { UIComponent, UIComponentType } from './types'

export function renderComponentTree(components: UIComponent[]): string {
  const content = components.map(c => renderComponent(c, true)).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #050505; margin: 0; min-height: 100vh; overflow-x: hidden; }
    #canvas { position: relative; width: 100%; min-height: 100vh; }
    .component-outline:hover { outline: 1px dashed rgba(74, 222, 128, 0.5); }
  </style>
</head>
<body>
  <div id="canvas">
    ${content}
  </div>
</body>
</html>`
}

function renderComponent(comp: UIComponent, isTopLevel: boolean = false): string {
  const { type, props, children, x, y, w, h } = comp
  
  const style = isTopLevel 
    ? `position: absolute; left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`
    : ''

  const childrenHtml = children.map(c => renderComponent(c, false)).join('\n')
  
  const commonClasses = `component-outline ${props.extraClasses || ''} ${props.padding || ''} ${props.color || ''} ${props.bgColor || ''} ${props.borderColor || ''} ${props.rounded ? 'rounded-lg' : ''} ${props.shadow ? 'shadow-lg' : ''}`

  switch (type) {
    case 'container':
      return `<div class="relative ${commonClasses}" style="${style}">${childrenHtml}</div>`
    
    case 'row':
      return `<div class="flex flex-row ${props.gap || 'gap-2'} ${props.align === 'center' ? 'items-center' : props.align === 'right' ? 'items-end' : 'items-start'} ${commonClasses}" style="${style}">${childrenHtml}</div>`
    
    case 'column':
      return `<div class="flex flex-col ${props.gap || 'gap-2'} ${commonClasses}" style="${style}">${childrenHtml}</div>`
    
    case 'heading':
      return `<h2 class="font-bold text-xl ${props.align === 'center' ? 'text-center' : props.align === 'right' ? 'text-right' : ''} ${commonClasses}" style="${style}">${props.text || 'Heading'}</h2>`
    
    case 'paragraph':
      return `<p class="text-sm ${props.align === 'center' ? 'text-center' : props.align === 'right' ? 'text-right' : ''} ${commonClasses}" style="${style}">${props.text || 'Paragraph text goes here...'}</p>`
    
    case 'label':
      return `<label class="text-xs font-medium uppercase tracking-wider ${commonClasses}" style="${style}">${props.text || 'Label'}</label>`

    case 'button':
      const variantClasses = props.variant === 'primary' ? 'bg-green-500 text-black hover:bg-green-400' :
                            props.variant === 'secondary' ? 'bg-zinc-800 text-white hover:bg-zinc-700' :
                            props.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-500' :
                            'bg-transparent border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
      const sizeClasses = props.size === 'sm' ? 'px-2 py-1 text-[10px]' :
                          props.size === 'lg' ? 'px-6 py-3 text-base' :
                          'px-4 py-2 text-sm'
      return `<button class="${variantClasses} ${sizeClasses} font-bold transition-colors ${commonClasses}" style="${style}">${props.text || 'Button'}</button>`
    
    case 'input':
      return `<input type="text" placeholder="${props.placeholder || 'Enter text...'}" class="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 w-full focus:border-green-500 focus:outline-none transition-colors ${commonClasses}" style="${style}" />`
    
    case 'textarea':
      return `<textarea placeholder="${props.placeholder || 'Enter multiline text...'}" rows="3" class="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 w-full focus:border-green-500 focus:outline-none transition-colors ${commonClasses}" style="${style}"></textarea>`
    
    case 'select':
      return `<select class="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 w-full focus:border-green-500 focus:outline-none transition-colors ${commonClasses}" style="${style}"><option>Option 1</option></select>`

    case 'image':
      return `<img src="${props.src || 'https://via.placeholder.com/150'}" class="object-cover ${commonClasses}" style="${style}" alt="UI element" />`
    
    case 'icon':
      return `<div class="w-6 h-6 flex items-center justify-center ${commonClasses}" style="${style}">★</div>`

    case 'divider':
      return `<hr class="border-zinc-800 my-2 ${commonClasses}" style="${style}" />`
    
    case 'spacer':
      return `<div class="${props.padding || 'h-4'} ${commonClasses}" style="${style}"></div>`
    
    case 'badge':
      return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${props.bgColor || 'bg-green-500/10'} ${props.color || 'text-green-400'} border border-current ${commonClasses}" style="${style}">${props.text || 'Badge'}</span>`
    
    case 'alert':
      return `<div class="p-3 rounded border ${props.borderColor || 'border-yellow-500/20'} ${props.bgColor || 'bg-yellow-500/5'} text-xs text-yellow-200 ${commonClasses}" style="${style}">${props.text || 'This is an alert message.'}</div>`
    
    case 'card':
      return `<div class="bg-zinc-900 border border-zinc-800 p-4 ${commonClasses}" style="${style}">${childrenHtml || '<div class="text-[10px] text-zinc-600 uppercase italic">Empty Card</div>'}</div>`

    default:
      return `<div class="p-2 border border-dashed border-zinc-800 text-[10px] text-zinc-500 uppercase" style="${style}">Unknown: ${type}</div>`
  }
}
