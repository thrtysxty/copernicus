import React from 'react'
import { UIComponentType, UIComponentProps } from '../types'

import { ButtonTile } from './ButtonTile'
import { InputTile } from './InputTile'
import { TextareaTile } from './TextareaTile'
import { SelectTile } from './SelectTile'
import { HeadingTile } from './HeadingTile'
import { ParagraphTile } from './ParagraphTile'
import { ContainerTile } from './ContainerTile'
import { RowTile } from './RowTile'
import { ColumnTile } from './ColumnTile'
import { CardTile } from './CardTile'
import { BadgeTile } from './BadgeTile'
import { AlertTile } from './AlertTile'
import { DividerTile } from './DividerTile'
import { SpacerTile } from './SpacerTile'
import { ImageTile } from './ImageTile'

export const TILE_MAP: Record<UIComponentType, React.FC<{ props: UIComponentProps }>> = {
  button: ButtonTile,
  input: InputTile,
  textarea: TextareaTile,
  select: SelectTile,
  heading: HeadingTile,
  paragraph: ParagraphTile,
  label: ParagraphTile,       // shared
  container: ContainerTile,
  row: RowTile,
  column: ColumnTile,
  card: CardTile,
  badge: BadgeTile,
  alert: AlertTile,
  divider: DividerTile,
  spacer: SpacerTile,
  image: ImageTile,
  icon: SpacerTile,           // placeholder until IconTile added
}
