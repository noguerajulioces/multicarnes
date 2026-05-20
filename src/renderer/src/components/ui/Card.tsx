import { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Default radius/shadow match the de-facto "house" card style used across the
  // app (every page previously overrode rounded-lg/shadow-card to these). Baking
  // them in keeps cards visually coherent even when a usage forgets to override.
  return (
    <div
      className={cn('bg-surface rounded-2xl shadow-card-soft border border-border', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 border-b border-border', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4 border-t border-border', className)} {...props} />
}
