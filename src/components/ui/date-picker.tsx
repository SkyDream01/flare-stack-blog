import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { MOTION, useMotionPresence } from "@/hooks/use-motion";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

interface DatePickerProps {
  /** UTC calendar dates in YYYY-MM-DD format. */
  value: string;
  onChange: (date: string) => void;
  today?: string;
  maxDate?: string;
  className?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  today,
  maxDate,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const present = useMotionPresence(isOpen, MOTION.popover);
  const containerRef = useRef<HTMLDivElement>(null);

  const todayDate = today ?? new Date().toISOString().slice(0, 10);
  const activeDate = value || todayDate;
  const [viewDate, setViewDate] = useState(
    () => new Date(`${activeDate}T00:00:00Z`),
  );
  const locale = getLocale();
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  useEffect(() => {
    setViewDate(new Date(`${activeDate}T00:00:00Z`));
  }, [activeDate]);

  const daysOfWeek = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeTag, {
      weekday: "narrow",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 7 + index))),
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    return new Date(Date.UTC(year, month, 1)).getUTCDay();
  };

  const adjacentMonth = (offset: number) =>
    new Date(
      Date.UTC(viewDate.getUTCFullYear(), viewDate.getUTCMonth() + offset, 1),
    );

  const formatMonth = (date: Date) =>
    date.toLocaleString(localeTag, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

  const dayValue = (day: number) => {
    const year = viewDate.getUTCFullYear();
    const month = (viewDate.getUTCMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    return `${year}-${month}-${dayStr}`;
  };

  const handleDayClick = (day: number) => {
    onChange(dayValue(day));
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDay = getFirstDayOfMonth(viewDate);
    const slots = [];

    for (let i = 0; i < firstDay; i++) {
      slots.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = dayValue(i);
      const selected = date === value;
      const isToday = date === todayDate;
      const disabled = Boolean(maxDate && date > maxDate);

      slots.push(
        <button
          key={i}
          type="button"
          disabled={disabled}
          aria-pressed={selected}
          aria-current={isToday ? "date" : undefined}
          onClick={() => handleDayClick(i)}
          className={`
            w-8 h-8 text-xs flex items-center justify-center rounded-lg transition-all relative disabled:cursor-not-allowed disabled:opacity-30
            ${
              selected
                ? "bg-(--fuwari-primary) text-white"
                : "fuwari-text-75 enabled:hover:bg-(--fuwari-btn-regular-bg)"
            }
            ${isToday && !selected ? "font-medium fuwari-text-90" : ""}
          `}
        >
          {i}
          {isToday && !selected && (
            <div className="absolute bottom-1 left-1/2 h-px w-1 -translate-x-1/2 bg-(--fuwari-primary)"></div>
          )}
        </button>,
      );
    }

    return slots;
  };

  return (
    <div
      className={`relative ${className}`}
      ref={containerRef}
      onKeyDown={(event) => {
        if (isOpen && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          containerRef.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen) setViewDate(new Date(`${activeDate}T00:00:00Z`));
          setIsOpen(!isOpen);
        }}
        className="relative h-10 w-full cursor-pointer rounded-xl bg-(--fuwari-btn-regular-bg) pl-9 pr-3 text-left text-sm fuwari-text-90"
      >
        <CalendarIcon
          className="absolute left-3 top-1/2 -translate-y-1/2 fuwari-text-50"
          size={14}
          strokeWidth={1.5}
        />
        <span className={value ? "" : "fuwari-text-30"}>
          {value || m.common_select_date()}
        </span>
      </button>

      {present && (
        <div
          data-state={isOpen ? "open" : "closing"}
          inert={!isOpen}
          className="fuwari-popover-motion absolute top-full left-0 z-50 mt-2 w-70 rounded-xl bg-(--fuwari-card-bg) p-4 shadow-md ring-1 ring-(--fuwari-input-border)"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium fuwari-text-90">
              {formatMonth(viewDate)}
            </h4>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={formatMonth(adjacentMonth(-1))}
                onClick={() => setViewDate(adjacentMonth(-1))}
                className="p-1 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                aria-label={formatMonth(adjacentMonth(1))}
                onClick={() => setViewDate(adjacentMonth(1))}
                className="p-1 fuwari-text-50 hover:text-(--fuwari-primary) transition-colors"
              >
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Grid Header (Days) */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {daysOfWeek.map((d, index) => (
              <div
                key={index}
                className="w-8 text-center text-[11px] fuwari-text-30"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          <div className="grid grid-cols-7 gap-0.5">{renderCalendar()}</div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
