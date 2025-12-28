"use client"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxProps {
  options: { value: string; label: string }[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  size?: "xs" | "sm" | "default"
}

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "선택...",
      disabled = false,
      className,
      triggerClassName,
      contentClassName,
      size = "default",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)

    const selectedLabel = React.useMemo(
      () => options.find((opt) => opt.value === value)?.label || placeholder,
      [options, value, placeholder]
    )

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            size={size}
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between",
              triggerClassName
            )}
          >
            <span className="truncate">{selectedLabel}</span>
            <ChevronsUpDown className={cn("ml-1 shrink-0 opacity-50", size === "xs" ? "h-2 w-2" : "h-4 w-4")} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("w-full p-0", contentClassName)} align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandEmpty>찾을 수 없습니다.</CommandEmpty>
            <CommandList>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={(currentValue) => {
                      onValueChange?.(
                        currentValue === value ? "" : currentValue
                      )
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)
Combobox.displayName = "Combobox"

export { Combobox }
